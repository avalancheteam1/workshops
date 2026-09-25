# On-chain Guestbook

## Overview

You deploy a dead-simple on-chain guestbook to the Avalanche Fuji testnet and put a live web app in front of it. Anyone can call `sign(message)`; the wall fills in live, each entry linking out to its transaction on Snowtrace. Every entry is permanent, publicly readable, and owned by the wallet that wrote it. There is no admin function that can edit or wipe it.

The contract is [`Guestbook.sol`](../assets/Guestbook.sol). The full project (Foundry contracts, tests, deploy script, and the Next.js app) lives in the [code repository](https://github.com/ahmedali8/avalancheteam1-builders-brunch-workshops/tree/main/packages/guestbook):

```text
packages/guestbook/
├── contracts/     Foundry: Solidity 0.8.36, forge-std, bun-managed deps
└── app/           Next.js + wagmi + RainbowKit + viem + Tailwind + Biome
```

## Learning objectives

- Read a small contract that stores user-owned data and emits an event per write.
- Test, deploy, and verify a contract on Fuji with Foundry, without a plaintext private key on disk.
- Connect a Next.js app to the contract with wagmi and RainbowKit.
- Build a live feed from a paginated read plus an event subscription, with no indexer.

## Prerequisites

- Completed [Getting Started with Avalanche](../../getting-started/en/README.md): a wallet on Fuji with test AVAX.
- A **throwaway** wallet funded from the [Fuji faucet](https://go.team1.network/faucet). Never use a wallet that holds real funds in a workshop.
- [Foundry](https://book.getfoundry.sh) (`forge`, `cast`): `curl -L https://getfoundry.sh/install | bash && foundryup`
- [Bun](https://bun.com/docs/installation): `curl -fsSL https://bun.sh/install | bash`
- [just](https://just.systems/man/en/packages.html), the task runner for the contracts: `brew install just`

## Workshop

### Part 1: Read the contract

Open [`Guestbook.sol`](../assets/Guestbook.sol). It has three parts:

- **Storage.** An `Entry` struct (`signer`, `message`, `timestamp`) in a private array. `signer` is `msg.sender`, which is what makes each entry owned by its wallet.
- **`sign(string message)`.** Rejects empty messages and anything over `MAX_MESSAGE_LENGTH` (280 bytes), appends the entry, and emits `Signed`. The length cap bounds the gas per call.
- **Reads.** `total()` for the counter, and `getEntries(offset, limit)` which returns a newest-first page. Paginating keeps every read bounded no matter how large the wall grows.

Notice what is missing: no owner, no `delete`, no upgrade. Nobody, including the deployer, can change an entry after it is written.

### Part 2: Get the code and run the tests

```sh
git clone https://github.com/ahmedali8/avalancheteam1-builders-brunch-workshops
cd avalancheteam1-builders-brunch-workshops
bun install                    # one install at the root covers every package
cd packages/guestbook/contracts
just test                      # 7 tests, all green
```

Solidity dependencies are bun-managed, not `forge install`-managed: `foundry.toml` sets `libs = ["node_modules"]` and `remappings.txt` points `forge-std/` there. Run `bun install`, never `forge install`.

### Part 3: Deploy to Fuji

Import your throwaway key into Foundry's encrypted keystore, so it is never written to `.env` or the repo:

```sh
just wallet-import             # paste the key once, set a password
cp .env.example .env           # set DEPLOYER_ADDRESS to the address wallet-import printed
```

`.env` holds only public values: `FUJI_RPC_URL` (the public endpoint works) and `DEPLOYER_ADDRESS`. It is git-ignored.

Simulate, then deploy:

```sh
just deploy-fuji               # dry run, no transaction sent
just deploy-fuji-live          # prints "Guestbook deployed at: 0x…"
```

Copy the printed address. The app needs it.

Verify the source on Snowtrace so anyone can read what they are about to sign. Snowtrace is powered by Routescan, which needs no API key:

```sh
just verify-fuji 0xYourAddress
```

Verification is deliberately a separate step. Bundling `--verify` into the deploy would let a flaky explorer API fail the recipe after the contract is already on chain.

The contract compiles with Solidity 0.8.36 and `evm_version = "prague"`. It uses no Prague-only features (no EIP-7702, no new precompiles), so the bytecode stays within the opcode set Fuji accepts.

### Part 4: Run the app

```sh
cd ../app
cp .env.local.example .env.local   # set NEXT_PUBLIC_GUESTBOOK_ADDRESS_FUJI to your address
bun run dev                        # http://localhost:3000
```

Connect a wallet (Core or MetaMask), type a message, and hit **Sign**. The entry lands on the wall once the receipt confirms, in about 1 to 2 seconds on Fuji. Click its transaction link through to [Snowtrace](https://testnet.snowtrace.io).

The feed has no indexer. It reads `getEntries` directly and watches the `Signed` event for live updates. Transaction links come from a 2000-block `Signed` log scan, because a contract cannot return its own transaction hash. The public Fuji RPC caps `eth_getLogs` at 2048 blocks, so older entries render without a link.

### Part 5: Sign it together

Share the app URL (or a QR code) with the room and have everyone sign from their own wallet. Watch the feed fill live, and open a few entries on Snowtrace to see who signed what.

### Optional: Run it locally on anvil

No faucet, no testnet. Two terminals in `contracts/`:

```sh
just anvil                     # terminal 1: local node, chain id 31337, 1s block time
just deploy-local              # terminal 2: deploys with anvil's public dev account #0
```

On a fresh anvil the address is `0x5FbDB2315678afecb367f032d93F642f64180aa3`. Put it in `.env.local` as `NEXT_PUBLIC_GUESTBOOK_ADDRESS_LOCAL`, then point your wallet at `http://127.0.0.1:8545` (chain id `31337`). To check the contract without the app, run `just smoke-local 0x5FbDB2315678afecb367f032d93F642f64180aa3`.

## Exercises

1. **Break it.** Call `sign("")` with `cast send` and read the `InvalidMessageLength` revert.
2. **Paginate.** Call `getEntries` with `cast call` and different `offset` and `limit` values. What does it return when `offset` is past the end?
3. **Stretch.** Add a `tip` so signers can attach AVAX to their entry. What new risks does holding funds introduce?

## Next steps

- Compare this with [Build Your First dApp](../../build-your-first-dapp/en/README.md), which calls a contract from a single HTML page with no framework.
- Add an indexer once the wall outgrows the 2048-block log window.

## Resources

- [Code repository](https://github.com/ahmedali8/avalancheteam1-builders-brunch-workshops/tree/main/packages/guestbook)
- [Foundry book](https://book.getfoundry.sh)
- [wagmi documentation](https://wagmi.sh)
- [RainbowKit documentation](https://rainbowkit.com/docs/introduction)
- [Snowtrace testnet](https://testnet.snowtrace.io)
- [Fuji faucet](https://go.team1.network/faucet)
- [Avalanche documentation](https://go.team1.network/docs)
