---
title: Getting Started with Avalanche
language: en
authors:
  - name: Avalanche Team1
    url: https://team1.network
translators: []
maintainers: [Avalanche Team1]
level: beginner
duration: 45 minutes
prerequisites: []
track: fundamentals
order: 1
last_updated: 2026-09-03
tested_with:
  core-wallet: browser extension
links:
  docs: https://go.team1.network/docs
---

# Getting Started with Avalanche

## Overview

In this workshop you set up a wallet, get test AVAX from the Fuji testnet faucet, send your first transaction, and read it back on a block explorer. By the end you understand what the Primary Network is, why Avalanche has more than one chain, and where smart contracts live.

## Learning objectives

- Explain the Primary Network and its three chains (P-Chain, X-Chain, C-Chain) in one sentence each.
- Install Core wallet and switch it to the Fuji testnet.
- Fund an address from the faucet and send a transaction.
- Find a transaction and an address on the Fuji explorer.
- Add the Fuji C-Chain to any EVM wallet by RPC URL and chain ID.

## Prerequisites

- A laptop with Chrome, Brave, or Firefox.
- No prior blockchain experience. No prior funds.

## Workshop

### Part 1: What is Avalanche? (10 min)

Avalanche is a network of blockchains. The **Primary Network** every validator joins has three chains:

| Chain | Purpose | You use it for |
|---|---|---|
| P-Chain | Platform: validators, staking, creating new blockchains | Staking, launching an L1 |
| X-Chain | Exchange: fast asset transfers | Rarely, today |
| C-Chain | Contract: an EVM chain | Almost everything: dApps, tokens, NFTs |

Beyond the Primary Network, anyone can launch their own **Avalanche L1** (formerly called a Subnet) with its own validators, gas token, and rules. The `build-your-first-dapp` workshop stays on the C-Chain. Later workshops cover L1s.

Two networks matter for you:

- **Mainnet**: real AVAX, real value.
- **Fuji testnet**: free test AVAX, same software. Everything in this workshop happens on Fuji.

### Part 2: Install Core wallet (10 min)

1. Install the Core browser extension from <https://go.team1.network/core>.
2. Create a new wallet. Write the recovery phrase on paper. Never type it into a website.
3. Open Settings → Advanced → enable **Testnet mode**. The balance now shows Fuji.
4. Copy your C-Chain address (starts with `0x`).

If you already use MetaMask or another EVM wallet, add Fuji manually instead:

| Field | Value |
|---|---|
| Network name | Avalanche Fuji C-Chain |
| RPC URL | `https://api.avax-test.network/ext/bc/C/rpc` |
| Chain ID | `43113` |
| Currency symbol | `AVAX` |
| Explorer | `https://testnet.snowtrace.io` |

### Part 3: Create a Builder Hub account (5 min)

The Avalanche Builder Hub is where the documentation, the academy courses, and the faucet live. Create an account at https://go.team1.network/builderhub and sign in. You need it for the next step and for every later workshop.

### Part 4: Get test AVAX (5 min)

1. Open the faucet at https://go.team1.network/faucet.
2. Select **Fuji (C-Chain)**, paste your address, request tokens. Ask the facilitator for a coupon code if the faucet asks for one.
3. Within a minute the balance in Core updates.

### Part 5: Send a transaction (5 min)

1. Pair up. Exchange addresses.
2. In Core, click **Send**, paste your partner's address, send 0.1 AVAX.
3. Note the transaction hash Core shows you.
4. Open https://testnet.snowtrace.io and paste the hash. Find:
   - the block number
   - the gas used and the fee paid
   - the `from` and `to` addresses
5. Click your address. You now see every transaction it was part of. This is public, forever.

Discussion: what does "finality" mean here, and how long did it take?

### Part 6: Read the chain without a wallet (10 min)

Every wallet talks to a node over JSON-RPC. You can do the same with `curl`:

```sh
curl -s https://api.avax-test.network/ext/bc/C/rpc \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["0xYOUR_ADDRESS","latest"]}'
```

The result is your balance in wei, as a hex string. Divide by 10^18 to get AVAX.

Try `eth_blockNumber` and `eth_chainId` too. Every dApp frontend you will ever build does exactly this under the hood.

## Exercises

1. **Chain ID check.** Call `eth_chainId` and convert the hex result to decimal. Does it match the table in Part 2?
2. **Fee math.** For your Part 5 transaction, compute fee = gas used × gas price from the explorer page. Compare with the fee shown.
3. **Explorer hunt.** Find the most recent block on Fuji. How many transactions did it contain? How many seconds since the previous block?
4. **Stretch.** Add Fuji to a second wallet (MetaMask) and import the same recovery phrase. Confirm both wallets show the same address and balance. Then delete that wallet again.

## Next steps

- Continue with [Build Your First dApp](../../build-your-first-dapp/en/README.md): deploy a contract to Fuji and call it from a web page.
- Read the Avalanche architecture overview in the documentation linked below.

## Resources

- [Avalanche documentation](https://go.team1.network/docs)
- [Core wallet](https://go.team1.network/core)
- [Builder Hub](https://go.team1.network/builderhub)
- [Fuji faucet](https://go.team1.network/faucet)
- [Fuji explorer (Snowtrace)](https://testnet.snowtrace.io)
- [Public RPC endpoints](https://build.avax.network/docs/tooling/rpc-providers)
