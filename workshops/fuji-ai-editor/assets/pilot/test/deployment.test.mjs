import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeManifest, validateManifest, reserve, loadLedger, recordHash, reconcile } from '../src/deployment.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const build = { sourceHash: 'source', compiler: '0.8.28', settings: { evmVersion: 'cancun' }, abi: [{ type: 'constructor', inputs: [{ name: 'owner', type: 'address' }, { name: 'initialValue', type: 'uint256' }] }], bytecode: '0x6000', runtimeBytecode: '0x00' };
const account = '0x0000000000000000000000000000000000000001';
const parameters = { account, owner: account, initialValue: '42', nonce: 0, gas: '100000', maxFeePerGas: '10000000000', maxPriorityFeePerGas: '1000000000' };

test('manifest binds constructor, network, bytecode and fee limits', () => {
  const m = makeManifest(build, parameters);
  validateManifest(m, build);
  for (const [key, value] of [['chainId', 43114], ['owner', '0x0000000000000000000000000000000000000002'], ['gas', '900000']]) {
    assert.throws(() => validateManifest({ ...m, [key]: value }, build));
  }
  assert.throws(() => validateManifest(m, { ...build, sourceHash: 'changed' }));
});

test('reserving before a wallet request prevents a second request after interruption', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fuji-ledger-'));
  const m = makeManifest(build, parameters);
  reserve(dir, m);
  assert.equal(loadLedger(dir, m.deploymentId).state, 'awaiting_signature');
  assert.throws(() => reserve(dir, m), /reconcile/i);
});

test('a regenerated plan with another nonce cannot silently redeploy the same intent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fuji-ledger-'));
  const a = makeManifest(build, parameters);
  const b = makeManifest(build, { ...parameters, nonce: 1 });
  assert.equal(a.deploymentId, b.deploymentId);
  reserve(dir, a);
  assert.throws(() => reserve(dir, b), /reconcile/i);
});

test('a changed recovery hash cannot inherit a receipt from the previous hash', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fuji-ledger-'));
  const m = makeManifest(build, parameters);
  const a = `0x${'a'.repeat(64)}`, b = `0x${'b'.repeat(64)}`;
  const transaction = { from: m.account, to: null, nonce: m.nonce, input: m.data, value: 0n, chainId: 43113, gas: BigInt(m.gas), maxFeePerGas: BigInt(m.maxFeePerGas), maxPriorityFeePerGas: BigInt(m.maxPriorityFeePerGas) };
  const client = { getChainId: async () => 43113, getTransaction: async () => transaction, getCode: async () => build.runtimeBytecode, getTransactionReceipt: async () => {
    await recordHash(dir, m, b, client);
    return { status: 'success', contractAddress: m.expectedAddress, blockNumber: 1n };
  } };
  reserve(dir, m); await recordHash(dir, m, a, client);
  const result = await reconcile(dir, m, client);
  assert.equal(result.txHash, b);
  assert.equal(result.state, 'submitted', 'The replacement must be checked against its own receipt');
});
