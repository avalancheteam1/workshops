import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const result = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
export function createPilotMcp(pilot) {
  const server = new McpServer({ name: 'team1-fuji-pilot', version: '0.1.0' }, { instructions: 'Prepare an owner-controlled counter on Avalanche Fuji from one conversational request. Use prepare_deployment, then show the signing URL. The person reviews and signs in a wallet; tools cannot sign or broadcast. Never request private keys or seed phrases. This pilot does not implement mainnet or arbitrary smart contracts.' });
  server.registerTool('prepare_deployment', {
    title: 'Prepare a counter on Avalanche Fuji',
    description: 'Prepare the reviewed counter starter from a single prompt. Defaults to zero. Returns a local wallet review link; the user connects their wallet to choose its owner. Repeated calls recover the same intent. Never claim deployed until deployment_status says confirmed. Mainnet and other contracts are unsupported.',
    inputSchema: z.object({ initial_value: z.string().regex(/^(0|[1-9][0-9]*)$/).max(78).default('0'), network: z.literal('fuji').default('fuji') }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ initial_value }) => {
    try { return result(await pilot.prepare(initial_value)); } catch (e) { return { ...result({ error: e.message }), isError: true }; }
  });
  server.registerTool('deployment_status', {
    title: 'Check a deployment', description: 'Read and reconcile a prepared Fuji deployment without sending transactions. Use the sessionId from prepare_deployment. Unknown or interrupted attempts stay reserved until the wallet hash is recovered.',
    inputSchema: z.object({ session_id: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ session_id }) => {
    try { return result(await pilot.status(session_id)); } catch (e) { return { ...result({ error: e.message }), isError: true }; }
  });
  server.registerTool('avalanche_help', {
    title: 'Avalanche deployment help', description: 'Explain the supported starter, wallet handoff and AvaKit-based Fuji configuration. No model credentials or signing keys are required.',
    inputSchema: z.object({}).strict(), annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => {
    return result({ starter: 'Owner-controlled counter', network: 'Avalanche Fuji 43113', runtime: 'AvaKit core 0.2.1 Fuji chain and RPC client; viem 2.57.18', signing: 'The user opens the local review link and approves in their browser wallet. No MCP tool can sign or broadcast.', mainnet: 'Unsupported; separate reviewed release required.', docs: ['https://avakit.dev/docs/core', 'https://build.avax.network/docs/primary-network'] });
  });
  return server;
}
