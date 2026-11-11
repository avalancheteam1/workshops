import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { get as httpGet } from 'node:http';
import { chromium } from 'playwright';
import { encodeFunctionData } from 'viem';
const { startPilot } = await import(process.env.PILOT_ROOT ? pathToFileURL(join(process.env.PILOT_ROOT, 'src/server.mjs')).href : new URL('../src/server.mjs', import.meta.url));

test('one prompt payload → wallet review → confirmed contract; interrupted retry recovers without redeployment', { timeout: 90000 }, async () => {
  const portServer = createServer(); await new Promise(r => portServer.listen(0, '127.0.0.1', r)); const port = portServer.address().port; await new Promise(r => portServer.close(r));
  const rpcUrl = `http://127.0.0.1:${port}`;
  const anvil = spawn(process.env.ANVIL_BIN || 'anvil', ['--silent', '--host', '127.0.0.1', '--port', String(port), '--chain-id', '43113', '--hardfork', 'cancun'], { stdio: 'ignore' });
  async function rpc(method, params = []) {
    const j = await (await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json();
    if (j.error) throw Error(JSON.stringify(j.error)); return j.result;
  }
  let pilot, browser;
  try {
    for (let i = 0; ; i++) { try { await rpc('eth_chainId'); break; } catch (e) { if (i > 50) throw e; await new Promise(r => setTimeout(r, 50)); } }
    const accounts = await rpc('eth_accounts');
    const stateDir = mkdtempSync(join(tmpdir(), 'fuji-pilot-e2e-'));
    pilot = await startPilot({ stateDir, rpcUrl });
    const first = await pilot.prepare('42');
    assert.equal(first.signingUrl, (await pilot.prepare('42')).signingUrl);
    const preview = new URL('api/preview', first.signingUrl);
    const invalidOrigin = await fetch(new URL('api/connect', first.signingUrl), { method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: JSON.stringify({ account: accounts[0] }) });
    assert.equal(invalidOrigin.status, 403);
    const badHost = await new Promise((resolve, reject) => { httpGet(preview, { headers: { host: 'attacker.example' } }, r => { r.resume(); resolve(r.statusCode); }).on('error', reject); }); assert.equal(badHost, 403);
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    const page = await browser.newPage();
    let mode = 'normal', lastHash, sends = 0;
    await page.exposeFunction('syntheticWallet', async ({ method, params }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return { result: [accounts[0]] };
      if (method === 'eth_sendTransaction') {
        sends++;
        if (mode === 'reject') return { error: { message: 'User rejected', code: 4001 } };
        lastHash = await rpc(method, params);
        if (mode === 'lose-response') return { error: { message: 'Wallet response interrupted after submission', code: -32603 } };
        return { result: lastHash };
      }
      return { result: await rpc(method, params) };
    });
    await page.addInitScript(() => { window.ethereum = { request: async payload => { const r = await window.syntheticWallet(payload); if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code }); return r.result; } }; });
    await page.goto(first.signingUrl);
    await page.getByRole('button', { name: 'Connect test wallet' }).click();
    await page.waitForFunction(() => !document.getElementById('review').hidden);
    assert.match(await page.locator('#summary').innerText(), /42/);
    mkdirSync('outputs/e2e', { recursive: true });
    await page.screenshot({ path: 'outputs/e2e/review.png', fullPage: true });
    await page.getByRole('button', { name: 'Review and deploy on Fuji' }).click();
    await page.waitForFunction(() => /confirmed|submitted/i.test(document.getElementById('status').textContent));
    await page.getByRole('button', { name: 'Check status' }).click();
    await page.waitForFunction(() => /confirmed/i.test(document.getElementById('status').textContent));
    const status = await pilot.status(first.sessionId); assert.equal(status.state, 'confirmed'); assert.equal(sends, 1);
    assert.equal(await pilot.client.readContract({ address: status.address, abi: pilot.build.abi, functionName: 'number' }), 42n);
    assert.equal((await pilot.client.readContract({ address: status.address, abi: pilot.build.abi, functionName: 'owner' })).toLowerCase(), accounts[0].toLowerCase());
    await assert.rejects(pilot.client.simulateContract({ account: accounts[1], address: status.address, abi: pilot.build.abi, functionName: 'setNumber', args: [99n] }));
    const update = await rpc('eth_sendTransaction', [{ from: accounts[0], to: status.address, data: encodeFunctionData({ abi: pilot.build.abi, functionName: 'setNumber', args: [99n] }) }]);
    assert.equal((await pilot.client.getTransactionReceipt({ hash: update })).status, 'success');
    assert.equal(await pilot.client.readContract({ address: status.address, abi: pilot.build.abi, functionName: 'number' }), 99n);
    await page.reload(); await page.getByRole('button', { name: 'Connect test wallet' }).click();
    await page.waitForFunction(() => /confirmed/i.test(document.getElementById('status').textContent));
    assert.ok(await page.getByRole('button', { name: 'Review and deploy on Fuji' }).isDisabled()); assert.equal(sends, 1);

    // Explicit rejection is safe to retry only after another human action.
    mode = 'reject';
    const rejected = await pilot.prepare('7'); await page.goto(rejected.signingUrl); await page.getByRole('button', { name: 'Connect test wallet' }).click(); await page.waitForFunction(() => !document.getElementById('review').hidden);
    await page.getByRole('button', { name: 'Review and deploy on Fuji' }).click(); await page.waitForFunction(() => /rejected/i.test(document.getElementById('status').textContent));
    assert.equal((await pilot.status(rejected.sessionId)).state, 'rejected');
    assert.ok(await page.getByRole('button', { name: 'Review and deploy on Fuji' }).isEnabled());

    // A lost hash stays reserved, even if the actual EVM transaction succeeded.
    mode = 'lose-response';
    await page.getByRole('button', { name: 'Review and deploy on Fuji' }).click(); await page.waitForFunction(() => /interrupted/i.test(document.getElementById('status').textContent));
    const sentBeforeRecovery = sends; assert.equal((await pilot.status(rejected.sessionId)).state, 'awaiting_signature');
    await pilot.close(); pilot = await startPilot({ stateDir, rpcUrl });
    const interrupted = await pilot.prepare('7');
    await page.goto(interrupted.signingUrl); await page.getByRole('button', { name: 'Connect test wallet' }).click(); await page.waitForFunction(() => !document.getElementById('review').hidden);
    assert.ok(await page.getByRole('button', { name: 'Review and deploy on Fuji' }).isDisabled());
    await page.getByLabel('Transaction hash from your wallet').fill(update); await page.getByRole('button', { name: 'Recover transaction' }).click(); await page.waitForFunction(() => /differs/i.test(document.getElementById('status').textContent));
    await page.getByLabel('Transaction hash from your wallet').fill(lastHash); await page.getByRole('button', { name: 'Recover transaction' }).click(); await page.waitForFunction(() => /confirmed/i.test(document.getElementById('status').textContent), null, { timeout: 3000 });
    assert.equal((await pilot.status(interrupted.sessionId)).state, 'confirmed'); assert.equal(sends, sentBeforeRecovery);

    // Persistence survives the MCP/runtime being restarted.
    await pilot.close(); pilot = await startPilot({ stateDir, rpcUrl });
    const resumed = await pilot.prepare('7'); await page.goto(resumed.signingUrl); await page.getByRole('button', { name: 'Connect test wallet' }).click(); await page.waitForFunction(() => /confirmed/i.test(document.getElementById('status').textContent));
    assert.equal(sends, sentBeforeRecovery);
    mode = 'normal';
    await rpc('evm_setAutomine', [false]);
    const pending = await pilot.prepare('12'); await page.goto(pending.signingUrl); await page.getByRole('button', { name: 'Connect test wallet' }).click(); await page.waitForFunction(() => !document.getElementById('review').hidden);
    await page.getByRole('button', { name: 'Review and deploy on Fuji' }).click(); await page.waitForFunction(() => /pending|submitted/i.test(document.getElementById('status').textContent));
    assert.equal((await pilot.status(pending.sessionId)).state, 'submitted');
    const pendingSends = sends;
    await pilot.close(); pilot = await startPilot({ stateDir, rpcUrl });
    const pendingResumed = await pilot.prepare('12'); await page.goto(pendingResumed.signingUrl); await page.getByRole('button', { name: 'Connect test wallet' }).click(); await page.waitForFunction(() => !document.getElementById('review').hidden);
    assert.ok(await page.getByRole('button', { name: 'Review and deploy on Fuji' }).isDisabled());
    await rpc('evm_mine'); await rpc('evm_setAutomine', [true]);
    await page.getByRole('button', { name: 'Check status' }).click(); await page.waitForFunction(() => /confirmed/i.test(document.getElementById('status').textContent)); assert.equal(sends, pendingSends);
    const concurrent = await pilot.prepare('88');
    const post = async (action, value) => { const r = await fetch(new URL(`api/${action}`, concurrent.signingUrl), { method: 'POST', headers: { origin: pilot.origin, 'content-type': 'application/json' }, body: JSON.stringify(value) }); const j = await r.json(); assert.equal(r.status, 200, JSON.stringify(j)); return j; };
    const reviewed = (await post('connect', { account: accounts[0] })).manifest;
    const originalBalance = pilot.client.getBalance;
    let release, entered; const blocked = new Promise(r => { entered = r; }); const gate = new Promise(r => { release = r; }); let firstBalance = true;
    pilot.client.getBalance = async args => { if (firstBalance) { firstBalance = false; entered(); await gate; } return originalBalance(args); };
    const reservation = post('reserve', { manifestHash: reviewed.manifestHash });
    await blocked;
    try { await post('connect', { account: accounts[1] }); } finally { release(); }
    const reserved = await reservation;
    assert.equal(reserved.transaction.from.toLowerCase(), accounts[0].toLowerCase(), 'Concurrent connection must not replace the reviewed signing request');
    pilot.client.getBalance = originalBalance;
    await rpc('anvil_setChainId', [43114]);
    const wrongNetwork = await pilot.prepare('123'); await page.goto(wrongNetwork.signingUrl); await page.getByRole('button', { name: 'Connect test wallet' }).click(); await page.waitForFunction(() => /Switch your wallet to Avalanche Fuji/i.test(document.getElementById('status').textContent));
    assert.equal(sends, pendingSends);
  } finally { await browser?.close(); await pilot?.close(); anvil.kill('SIGTERM'); }
});
