import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import solc from 'solc';
import { buildProject } from '../src/build.mjs';
import { digest } from '../src/deployment.mjs';

test('reviewed source travels with its compiled artifact and reproduces its bytecode', async () => {
  const build = await buildProject(fileURLToPath(new URL('../', import.meta.url)));
  assert.equal(typeof build.source, 'string', 'Artifact must carry the exact source read by the compiler');
  assert.equal(build.sourceHash, digest(build.source));
  const compiled = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'Counter.sol': { content: build.source } }, settings: build.settings })));
  assert.equal(`0x${compiled.contracts['Counter.sol'].Counter.evm.bytecode.object}`, build.bytecode);
});
