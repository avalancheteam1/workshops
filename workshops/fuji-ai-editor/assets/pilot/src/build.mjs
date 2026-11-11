import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
export async function buildProject(root) {
  const source = join(root, 'contracts/Counter.sol');
  const { stdout } = await promisify(execFile)(process.execPath, ['--max-old-space-size=256', fileURLToPath(new URL('./compiler.mjs', import.meta.url)), source], { timeout: 20000, maxBuffer: 2 * 1024 * 1024, env: { PATH: process.env.PATH } });
  return JSON.parse(stdout);
}
