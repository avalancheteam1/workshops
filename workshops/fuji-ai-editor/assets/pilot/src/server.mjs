import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { getAddress } from 'viem';
import { buildProject } from './build.mjs';
import { clientFor, makeManifest, validateManifest, preflight, loadLedger, reserve, recordHash, recordRejection, reconcile, walletRequest, atomicJSON, digest, CHAIN_ID } from './deployment.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 16384) throw Error('Request too large'); }
  return JSON.parse(text || '{}');
}
export async function startPilot({ stateDir, rpcUrl, root = packageRoot } = {}) {
  if (!stateDir) throw Error('A private local state directory is required.');
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const ledgerDir = join(stateDir, 'ledger');
  const build = await buildProject(root), client = clientFor(rpcUrl);
  function checkSource() { if (digest(readFileSync(join(root, 'contracts/Counter.sol'), 'utf8')) !== build.sourceHash) throw Error('Contract source changed. Restart and review a new build before signing.'); }
  const sessions = new Map();
  let origin;
  function send(res, status, value, type = 'application/json') {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
    res.end(type === 'application/json' ? JSON.stringify(value) : value);
  }
  const server = createServer(async (req, res) => {
    try {
      if (req.headers.host !== new URL(origin).host) return send(res, 403, { error: 'Invalid host' });
      const url = new URL(req.url, origin);
      if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { status: 'ok', network: 'fuji', version: '0.1.0' });
      if (req.method === 'GET' && ['/font-body.woff2', '/font-heading.woff2'].includes(url.pathname)) {
        const weight = url.pathname === '/font-body.woff2' ? 300 : 500;
        return send(res, 200, readFileSync(require.resolve(`@fontsource/kanit/files/kanit-latin-${weight}-normal.woff2`)), 'font/woff2');
      }
      if (req.method === 'GET' && ['/favicon.ico', '/apple-icon.png'].includes(url.pathname)) return send(res, 200, readFileSync(join(root, 'public', url.pathname.slice(1))), url.pathname.endsWith('.ico') ? 'image/x-icon' : 'image/png');
      if (req.method === 'GET' && ['/app.js', '/style.css'].includes(url.pathname)) {
        return send(res, 200, readFileSync(join(root, 'public', url.pathname.slice(1)), 'utf8'), url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css');
      }
      const match = /^\/s\/([a-f0-9]{64})\/([a-f0-9]{48})\/(.*)$/.exec(url.pathname);
      const s = match && sessions.get(match[1]);
      if (!s || s.token !== match[2]) {
        if (req.method === 'GET' && req.headers.accept?.includes('text/html')) return send(res, 404, '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signing Link Unavailable</title><link rel="stylesheet" href="/style.css"></head><body><main><h1>Ask for a fresh signing link.</h1><p>This local session is unavailable. Ask your assistant to prepare the same counter again. Your saved deployment records are preserved.</p></main></body></html>', 'text/html');
        return send(res, 404, { error: 'Signing session not found. Ask your assistant to prepare it again.' });
      }
      const action = match[3];
      if (action.startsWith('api/')) {
        const now = Date.now();
        if (!s.windowStart || now - s.windowStart > 60000) { s.windowStart = now; s.requests = 0; }
        if (++s.requests > 60) return send(res, 429, { error: 'Too many requests. Wait a minute; your deployment reservation is preserved.' });
      }
      if (req.method === 'GET' && action === '') return send(res, 200, readFileSync(join(root, 'public/index.html'), 'utf8'), 'text/html');
      if (req.method === 'GET' && action === 'api/preview') return send(res, 200, { network: 'Avalanche Fuji testnet', initialValue: s.initialValue, sourceHash: build.sourceHash, source: build.source, manifest: s.manifest || null, localDevelopment: rpcUrl !== undefined });
      if (req.method === 'GET' && action === 'api/manifest' && s.manifest) return send(res, 200, s.manifest);
      if (req.method === 'GET' && action === 'api/status') return send(res, 200, s.manifest ? await reconcile(ledgerDir, s.manifest, client) : { state: 'connect_wallet' });
      if (req.method !== 'POST' || req.headers.origin !== origin || req.headers['content-type'] !== 'application/json') return send(res, 403, { error: 'Same-origin JSON request required.' });
      const input = await body(req);
      if (action === 'api/connect') {
        checkSource();
        const account = getAddress(input.account);
        if (await client.getChainId() !== CHAIN_ID) throw Error('RPC chain mismatch: Fuji 43113 required.');
        const nonce = await client.getTransactionCount({ address: account, blockTag: 'pending' });
        const provisional = makeManifest(build, { account, owner: account, initialValue: s.initialValue, nonce, gas: '5000000', maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
        const existing = loadLedger(ledgerDir, provisional.deploymentId);
        let candidate;
        if (existing && existing.state !== 'rejected') candidate = existing.manifest;
        else {
          const estimate = await client.estimateGas({ account, data: provisional.data, value: 0n });
          candidate = makeManifest(build, { ...provisional, gas: ((estimate * 120n + 99n) / 100n).toString() });
          await preflight(client, candidate);
        }
        validateManifest(candidate, build);
        atomicJSON(join(stateDir, `${candidate.deploymentId}.manifest.json`), candidate);
        s.manifest = candidate;
        return send(res, 200, { manifest: candidate, status: await reconcile(ledgerDir, candidate, client) });
      }
      // Bind each asynchronous request to the object the person reviewed. A
      // second tab may connect another wallet while preflight awaits the RPC.
      const manifest = s.manifest;
      if (!manifest || input.manifestHash !== manifest.manifestHash) throw Error('Review the current deployment manifest first.');
      validateManifest(manifest, build);
      if (action === 'api/reserve') {
        checkSource();
        await preflight(client, manifest);
        reserve(ledgerDir, manifest);
        return send(res, 200, { transaction: walletRequest(manifest) });
      }
      if (action === 'api/reject') {
        if (input.code !== 4001) throw Error('Only explicit wallet rejection releases a reservation. Other failures must be reconciled.');
        return send(res, 200, recordRejection(ledgerDir, manifest));
      }
      if (action === 'api/hash') {
        await recordHash(ledgerDir, manifest, input.hash, client);
        return send(res, 200, await reconcile(ledgerDir, manifest, client));
      }
      return send(res, 404, { error: 'Unknown action' });
    } catch (e) {
      console.error('Fuji pilot request failed; transaction reservations are preserved.');
      send(res, 400, { error: e.message });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin, build, ledgerDir, client,
    async prepare(initialValue = '0') {
      if (!/^(0|[1-9][0-9]*)$/.test(initialValue) || BigInt(initialValue) >= 1n << 256n) throw Error('Initial value must be a uint256 decimal string.');
      const id = digest({ build, initialValue });
      if (!sessions.has(id)) {
        if (sessions.size >= 32) throw Error('Session limit reached. Restart the local app; recorded transactions are preserved.');
        sessions.set(id, { token: randomBytes(24).toString('hex'), initialValue });
      }
      const s = sessions.get(id);
      return { starter: 'owner-controlled counter', initialValue, network: 'Avalanche Fuji testnet (43113)', sessionId: id, signingUrl: `${origin}/s/${id}/${s.token}/`, nextAction: 'Open signingUrl on this computer. Connect your test wallet, review the manifest, then approve in your wallet. Never share seed phrases or private keys. Mainnet is not supported by this pilot.' };
    },
    async status(id) {
      const s = sessions.get(id);
      if (!s) throw Error('Unknown session; prepare the same counter again to recover it.');
      if (!s.manifest) return { state: 'connect_wallet', signingUrl: `${origin}/s/${id}/${s.token}/` };
      const result = await reconcile(ledgerDir, s.manifest, client);
      return { state: result.state, address: result.address, txHash: result.txHash, guidance: result.guidance };
    },
    close: () => new Promise(r => server.close(r)),
  };
}
