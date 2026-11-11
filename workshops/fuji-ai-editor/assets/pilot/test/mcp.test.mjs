import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('installable MCP accepts one simple request, reuses it, and exposes no signing tool', async () => {
  const client = new Client({ name: 'pilot-test', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [process.env.PILOT_ENTRY || fileURLToPath(new URL('../src/index.mjs', import.meta.url))], env: { TEAM1_PILOT_STATE_DIR: mkdtempSync(join(tmpdir(), 'fuji-mcp-')) }, stderr: 'pipe' });
  let errors = ''; transport.stderr.on('data', b => { errors += b; });
  try {
    await client.connect(transport);
    assert.deepEqual((await client.listTools()).tools.map(t => t.name).sort(), ['avalanche_help', 'deployment_status', 'prepare_deployment']);
    const call = args => client.callTool({ name: 'prepare_deployment', arguments: args });
    const first = JSON.parse((await call({ initial_value: '42' })).content[0].text);
    const again = JSON.parse((await call({ initial_value: '42' })).content[0].text);
    assert.equal(first.signingUrl, again.signingUrl);
    const page = await fetch(first.signingUrl); assert.equal(page.status, 200); assert.match(await page.text(), /Connect test wallet/);
    const mainnet = await call({ network: 'mainnet' }); assert.ok(mainnet.isError);
    const arbitrary = await call({ source: 'anything' }); assert.ok(arbitrary.isError);
    const status = await client.callTool({ name: 'deployment_status', arguments: { session_id: first.sessionId } });
    assert.equal(JSON.parse(status.content[0].text).state, 'connect_wallet');
    const help = await client.callTool({ name: 'avalanche_help', arguments: {} }); assert.ok(!help.isError, JSON.stringify(help)); assert.match(help.content[0].text, /AvaKit/);
    assert.equal(errors, '');
  } finally { await client.close(); }
});
