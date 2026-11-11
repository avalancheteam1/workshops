import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const stage = join(root, 'work/bundle'), output = join(root, 'outputs');
rmSync(stage, { recursive: true, force: true }); mkdirSync(stage, { recursive: true }); mkdirSync(output, { recursive: true });
for (const path of ['src', 'public', 'contracts', 'manifest.json', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'LICENSE']) cpSync(join(root, path), join(stage, path), { recursive: true });
// MCP bundle extraction does not preserve pnpm's virtual-store symlink layout.
// A locked, hoisted production install makes the download self-contained.
writeFileSync(join(stage, 'pnpm-workspace.yaml'), `${readFileSync(join(stage, 'pnpm-workspace.yaml'), 'utf8')}\nnodeLinker: hoisted\n`);
if (execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim() !== '11.24.0') throw Error('Packaging requires pnpm 11.24.0.');
execFileSync('pnpm', ['install', '--prod', '--frozen-lockfile', '--ignore-scripts'], { cwd: stage, stdio: 'inherit' });
const cli = join(root, 'node_modules/.bin/mcpb');
const artifact = join(output, 'team1-fuji-pilot-0.1.0.mcpb');
execFileSync(cli, ['pack', stage, artifact], { cwd: root, stdio: 'inherit' });
const sha = createHash('sha256').update(readFileSync(artifact)).digest('hex');
writeFileSync(`${artifact}.sha256`, `${sha}  ${artifact.split('/').at(-1)}\n`);
const unpacked = join(root, 'work/unpacked');
rmSync(unpacked, { recursive: true, force: true });
execFileSync(cli, ['unpack', artifact, unpacked], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, ['--test', 'test/mcp.test.mjs'], { cwd: root, stdio: 'inherit', env: { ...process.env, PILOT_ENTRY: join(unpacked, 'src/index.mjs') } });
console.log(`Bundle and SHA-256 checksum: ${output}`);
