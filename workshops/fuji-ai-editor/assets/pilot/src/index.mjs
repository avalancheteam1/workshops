import { homedir } from 'node:os';
import { join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { startPilot } from './server.mjs';
import { createPilotMcp } from './mcp.mjs';

const pilot = await startPilot({ stateDir: process.env.TEAM1_PILOT_STATE_DIR || join(homedir(), '.team1-fuji-pilot'), rpcUrl: process.env.TEAM1_PILOT_RPC || undefined });
const server = createPilotMcp(pilot);
let closing = false;
async function close() { if (closing) return; closing = true; await server.close(); await pilot.close(); }
server.onclose = () => { if (!closing) { closing = true; void pilot.close(); } };
process.on('SIGINT', () => { void close(); });
process.on('SIGTERM', () => { void close(); });
await server.connect(new StdioServerTransport());
