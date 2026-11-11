# Maintainer and release status

Giacomo Barbieri authorized implementation of this bounded local pilot in Codex chat `01a1ca39-31d9-7411-a120-5fad8530d7c0` on 11 November 2026, then clarified that it must be installable in a conversational MCP client, without requiring an AI editor. Reuse of the existing workshops repository follows its contribution process. This records implementation scope, not a grant of official launch or public-chain spending authority.

- Application/project contact: Giacomo Barbieri (Jaack).
- Technical Owner: not yet formally assigned; confirm in the team1 owners sheet.
- Classification: local wallet/contract application pilot. Its sensitivity means it does not use the experiment exemption.
- Team1 Tech crypto/security review and final distribution approval: pending.
- Preferred-stack deviation: native Node is necessary for a downloadable stdio MCP and loopback signing utility; a hosted frontend, database and authentication service would add infrastructure without a consumer. Tech alignment remains a review item.
- Mainnet: unimplemented and rejected. It requires a separate reviewed release and explicit transaction approval.
- Deployment: local installer only. No official domain, hosted service or account-side ChatGPT/Claude installation is provisioned by the repository.

## Security and data

The model receives an initial value, a local review URL and status. Wallet addresses, manifests and transaction receipts stay in the local state directory; they are public chain data but may reveal user activity. There are no AI API calls, analytics, cookies or external transcription services. The only default blockchain endpoint is the public Fuji RPC. An explicit loopback override exists for synthetic tests. Never add signing keys to either client configuration or environment variables.

An in-flight ledger entry is retained through network and wallet errors. Only an explicit EIP-1193 rejection (4001) releases the reservation. Hash loss needs manual recovery; matching replacement hashes are validated against the exact manifest before being stored; reverted attempts are deliberately not reset automatically. Stale lock files require operator investigation, not an age-based automatic unlock.

Installed users must keep their wallet approval boundary. This is not isolation from a malicious assistant with unrestricted shell/filesystem control or a compromised wallet/browser. Mainnet credentials should never be available to those processes. Pilot/mainnet contract suitability remains subject to specialist review.

## Toolchain and dependencies

Node 26.8.1 and pnpm 11.24.0 are the tested maintainer environment; runtime uses Node 20.11+ APIs. The bundled Solidity compiler is 0.8.28 with Cancun and optimizer 200. Contract imports are not supported; compile execution is bounded to 20 seconds and a 256 MiB V8 heap.

Pinned AvaKit core 0.2.1 supplies the Fuji chain definition and RPC client. The unused scaffolder and stock signing MCP are excluded from the installer. Overrides update MCP SDK, viem, Zod, tmp and the Hono node server. The final production dependency audit reports zero advisories at all severities; this is not an exhaustive security audit. A package-manager audit must not trigger blind force-upgrades. Browser/Apple favicons were fetched from `avalancheteam1/common/brand/assets/favicon/` at revision `44063d26953a0c4a5b3158702cc197f349144eaf`; the Kanit package serves fonts locally. The private signing page is not a PWA and needs no web manifest.

Packaging stages only source, static assets, manifests and locked production dependencies. A hoisted production install avoids virtual-store symlinks in the archive; packaging unpacks the output and smoke-tests its actual MCP entry point. Generated `.mcpb` and checksum are ignored by git. Registry/package signatures do not constitute a signed publisher release; the pilot installer itself is unsigned until an authorized maintainer signs it. Native installation and physical wallet readiness are not established by a synthetic provider test.


The focused CI workflow validates this nested pilot. The reusable `team1-pr-review` workflow currently assumes root-level package/cache inputs; wiring it here would require repository-wide workspace changes. This remains a review warning, rather than restructuring unrelated workshops for the pilot.
