import { mkdirSync, writeFileSync, readFileSync, existsSync, openSync, closeSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { encodeDeployData, getAddress, getContractAddress, keccak256, createPublicClient, http } from 'viem';
import { fuji, getPublicClient } from '@avakit/core';

export const CHAIN_ID = fuji.id;
export const FUJI_RPC = fuji.rpcUrl;
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export const digest = v => createHash('sha256').update(typeof v === 'string' ? v : canonical(v)).digest('hex');
function uint(v, name, max = (1n << 256n) - 1n) {
  if (!/^(0|[1-9][0-9]*)$/.test(String(v)) || BigInt(v) > max) throw Error(`Invalid ${name}`);
  return BigInt(v);
}
export function atomicJSON(path, value) {
  const temp = `${path}.${process.pid}.tmp`, fd = openSync(temp, 'wx', 0o600);
  try { writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, path);
  const parent = openSync(join(path, '..'), 'r');
  try { fsyncSync(parent); } finally { closeSync(parent); }
}
export function makeManifest(build, p) {
  const account = getAddress(p.account), owner = getAddress(p.owner);
  const initialValue = uint(p.initialValue, 'initial value').toString();
  const nonce = Number(uint(p.nonce, 'nonce', BigInt(Number.MAX_SAFE_INTEGER)));
  const gas = uint(p.gas, 'gas', 5000000n).toString();
  const maxFeePerGas = uint(p.maxFeePerGas, 'maximum fee', 100000000000n).toString();
  const maxPriorityFeePerGas = uint(p.maxPriorityFeePerGas, 'priority fee').toString();
  if (owner === '0x0000000000000000000000000000000000000000' || !BigInt(gas) || !BigInt(maxFeePerGas) || BigInt(maxPriorityFeePerGas) > BigInt(maxFeePerGas)) throw Error('Invalid owner or fee limits');
  const identity = { sourceHash: build.sourceHash, compiler: build.compiler, settings: build.settings, abiHash: digest(build.abi), bytecodeHash: keccak256(build.bytecode), chainId: CHAIN_ID, account, owner, initialValue };
  const data = encodeDeployData({ abi: build.abi, bytecode: build.bytecode, args: [owner, BigInt(initialValue)] });
  const body = { version: 1, ...identity, deploymentId: digest(identity), buildHash: digest(build), nonce, gas, maxFeePerGas, maxPriorityFeePerGas, maxCostWei: (BigInt(gas) * BigInt(maxFeePerGas)).toString(), value: '0', data, dataHash: keccak256(data), runtimeHash: keccak256(build.runtimeBytecode), expectedAddress: getContractAddress({ from: account, nonce: BigInt(nonce) }) };
  return { ...body, manifestHash: digest(body) };
}
export function validateManifest(m, build) {
  if (m.chainId !== CHAIN_ID) throw Error('Fuji only: mainnet needs a separate reviewed workflow.');
  if (canonical(makeManifest(build, m)) !== canonical(m)) throw Error('Manifest or build changed; prepare and review a new plan.');
}
export function clientFor(rpc = FUJI_RPC) {
  const u = new URL(rpc);
  if (rpc !== FUJI_RPC && !(u.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(u.hostname))) throw Error('Only Fuji or an explicit loopback development node is allowed.');
  if (u.username || u.password || u.search || u.hash) throw Error('RPC credentials/query parameters are not supported.');
  return rpc === FUJI_RPC ? getPublicClient(fuji) : createPublicClient({ transport: http(rpc, { timeout: 10000, retryCount: 0 }) });
}
export async function preflight(client, m) {
  if (await client.getChainId() !== CHAIN_ID) throw Error('RPC chain mismatch: Fuji 43113 required.');
  const [latest, pending, balance] = await Promise.all([client.getTransactionCount({ address: m.account, blockTag: 'latest' }), client.getTransactionCount({ address: m.account, blockTag: 'pending' }), client.getBalance({ address: m.account })]);
  if (latest !== m.nonce || pending !== m.nonce) throw Error('Nonce changed or transaction pending; reconcile before signing.');
  if (balance < BigInt(m.maxCostWei)) throw Error('Insufficient test AVAX for the reviewed fee ceiling.');
  const estimate = await client.estimateGas({ account: m.account, data: m.data, value: 0n });
  if (estimate > BigInt(m.gas)) throw Error('Estimated gas exceeds the reviewed ceiling.');
}
function pathFor(dir, id) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Invalid deployment ID');
  return join(dir, `${id}.json`);
}
export function loadLedger(dir, id) { const p = pathFor(dir, id); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; }
function locked(dir, m, action) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const p = pathFor(dir, m.deploymentId), lock = `${p}.lock`;
  let fd;
  try { fd = openSync(lock, 'wx', 0o600); } catch { throw Error('Deployment locked; reconcile the previous process.'); }
  try { return action(p, loadLedger(dir, m.deploymentId)); } finally { closeSync(fd); unlinkSync(lock); }
}
export function reserve(dir, m) {
  return locked(dir, m, (p, entry) => {
    if (entry && entry.state !== 'rejected') throw Error(`Deployment ${entry.state}; reconcile instead of sending again.`);
    const next = { state: 'awaiting_signature', manifest: m, updatedAt: new Date().toISOString() };
    atomicJSON(p, next); return next;
  });
}
export function recordRejection(dir, m) {
  return locked(dir, m, (p, entry) => {
    if (entry?.state !== 'awaiting_signature' || entry.manifest.manifestHash !== m.manifestHash) throw Error('No matching wallet request.');
    entry.state = 'rejected'; atomicJSON(p, entry); return entry;
  });
}
function assertTransaction(tx, m) {
  if (tx.from.toLowerCase() !== m.account.toLowerCase() || tx.to !== null || tx.nonce !== m.nonce || tx.input.toLowerCase() !== m.data.toLowerCase() || tx.value !== 0n || tx.chainId !== CHAIN_ID || tx.gas > BigInt(m.gas) || (tx.maxFeePerGas ?? tx.gasPrice) > BigInt(m.maxFeePerGas) || (tx.maxPriorityFeePerGas ?? 0n) > BigInt(m.maxPriorityFeePerGas)) throw Error('Wallet transaction differs from the reviewed plan. Keep the reservation and investigate.');
}
export async function recordHash(dir, m, hash, client) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) throw Error('Invalid transaction hash');
  if (await client.getChainId() !== CHAIN_ID) throw Error('RPC chain mismatch.');
  // Validate a pasted candidate before storing it. A mistaken paste must never
  // poison recovery; the existing reservation stays intact on all read errors.
  assertTransaction(await client.getTransaction({ hash }), m);
  return locked(dir, m, (p, entry) => {
    if (!entry || entry.manifest.manifestHash !== m.manifestHash) throw Error('No matching deployment reservation.');
    if (entry.state === 'confirmed' && entry.txHash.toLowerCase() === hash.toLowerCase()) return entry;
    if (!['awaiting_signature', 'submitted'].includes(entry.state)) throw Error(`Deployment is ${entry.state}.`);
    entry.state = 'submitted'; entry.txHash = hash; atomicJSON(p, entry); return entry;
  });
}
export async function reconcile(dir, m, client) {
  const entry = loadLedger(dir, m.deploymentId);
  if (!entry) return { state: 'not_started' };
  if (entry.manifest.manifestHash !== m.manifestHash) throw Error('Use the recorded deployment manifest.');
  if (await client.getChainId() !== CHAIN_ID) throw Error('RPC chain mismatch.');
  if (!entry.txHash) return { ...entry, guidance: entry.state === 'rejected' ? 'Wallet rejected. A new human signing request is allowed.' : 'Do not retry. Recover the hash from your wallet and paste it on the signing page.' };
  let tx, receipt;
  try { tx = await client.getTransaction({ hash: entry.txHash }); } catch (e) { if (e.name === 'TransactionNotFoundError') return { ...entry, guidance: 'Transaction not found yet. Keep the reservation; do not resend.' }; throw e; }
  assertTransaction(tx, m);
  try { receipt = await client.getTransactionReceipt({ hash: entry.txHash }); } catch (e) { if (e.name === 'TransactionReceiptNotFoundError') return { ...entry, guidance: 'Pending. Check status again; never send another deployment.' }; throw e; }
  if (receipt.status === 'success') {
    if (receipt.contractAddress?.toLowerCase() !== m.expectedAddress.toLowerCase()) throw Error('Unexpected contract address');
    const code = await client.getCode({ address: receipt.contractAddress });
    if (!code || keccak256(code) !== m.runtimeHash) throw Error('Runtime code differs from the reviewed build.');
  }
  return locked(dir, m, (p, current) => {
    if (current.txHash?.toLowerCase() !== entry.txHash.toLowerCase()) return { ...current, guidance: 'A matching replacement hash was recorded while checking. Check status again for its own receipt.' };
    current.state = receipt.status === 'success' ? 'confirmed' : 'reverted';
    current.address = receipt.contractAddress; current.blockNumber = receipt.blockNumber.toString(); atomicJSON(p, current); return current;
  });
}
export function walletRequest(m) {
  const h = n => `0x${BigInt(n).toString(16)}`;
  return { from: m.account, chainId: h(CHAIN_ID), nonce: h(m.nonce), data: m.data, value: '0x0', gas: h(m.gas), maxFeePerGas: h(m.maxFeePerGas), maxPriorityFeePerGas: h(m.maxPriorityFeePerGas), type: '0x2' };
}
