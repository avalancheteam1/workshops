# Sealed-bid Auctions on a Permissioned L1

## Overview

Part 1 built a sealed-bid auction on a public chain, broke it by reading every "private" bid straight out of storage, then fixed it with commit-reveal. It ended on a question: *if the whole world can read the bids, why not run the auction on our own chain?*

This part does exactly that. You launch a permissioned Avalanche L1 on your machine, decide who may use it, and run the Part 1 contracts on it byte-for-byte: only the chain changes. Then you find out what that bought you, and what it didn't.

> **Public vs private is not about secrecy. It is about who is in the room.**

The L1's genesis and the allowlist precompile interface are in [`assets/`](../assets/). The contracts are Part 1's, unchanged: [`NaiveAuction.sol`](../../sealed-bid-auctions/assets/NaiveAuction.sol) and [`SealedBidAuction.sol`](../../sealed-bid-auctions/assets/SealedBidAuction.sol). The full project (tests, deploy scripts, justfile) lives in the [code repository](https://github.com/ahmedali8/avalancheteam1-builders-brunch-workshops/tree/main/packages/sealed-bid-auctions/part2-permissioned-l1).

## Learning objectives

- Launch a local permissioned Avalanche L1 from a genesis file with avalanche-cli.
- Control who may transact and who may deploy with Subnet-EVM's allowlist precompiles.
- Explain why a transaction allowlist does not hide storage from the accounts it lets in.
- Explain why commit-reveal is still needed on a private chain.

## Prerequisites

- Completed [Sealed-bid Auctions on a Public Blockchain](../../sealed-bid-auctions/en/README.md).
- The Part 1 tools: [Foundry](https://book.getfoundry.sh), [Bun](https://bun.com/docs/installation) and [just](https://just.systems/man/en/packages.html).
- [avalanche-cli](https://build.avax.network/docs/tooling/avalanche-cli). Tested with 1.9.6, which runs Subnet-EVM v0.8.0.
- [jq](https://jqlang.org/download/): `brew install jq`

## Workshop

### Part 1: Get the code and run the tests

```sh
git clone https://github.com/ahmedali8/avalancheteam1-builders-brunch-workshops
cd avalancheteam1-builders-brunch-workshops
bun install                    # one install at the root covers every package
cd packages/sealed-bid-auctions/part2-permissioned-l1
just test                      # the same 20 tests as Part 1
```

There are four people in this story. They are anvil's well-known accounts (public keys, local only, the same as Part 1), and you refer to each by name in every command:

| Name | Role |
| --- | --- |
| `admin` | Runs the chain. Decides who gets in. Deploys the auction and sells the asset. |
| `alice` | An invited bidder. |
| `bob` | Another invited bidder, and Alice's competitor. |
| `carol` | A bidder nobody invited. She has money, but no invitation. |

### Part 2: Build the room

The whole chain is described by one file, [`genesis.json`](../assets/genesis.json). It starts from avalanche-cli's defaults for a proof-of-authority L1, which carry the validator manager contracts, and changes four things:

- **Who may transact.** The transaction allowlist names `admin` as its admin and enables `alice` and `bob`. Nobody else can send a transaction.
- **Who may deploy.** The deployer allowlist names only `admin`.
- **Who starts with funds.** All four accounts get 1000 BRUNCH, the chain's own token, including `carol`, so it is clear that money alone does not get you in.
- **What a transaction costs.** The base fee floor is 1 wei and block gas cost is off, so nobody needs a faucet.

Both allowlists are *precompiles*: contracts at fixed addresses, built into the chain and switched on in genesis. There is no Solidity behind them (the logic is Go code inside the node), but they speak an ordinary contract ABI, written down in [`IAllowList.sol`](../assets/IAllowList.sol). The chain ID is 1717.

Boot it:

```sh
just l1-up
```

That takes about a minute: it starts a local Avalanche network, creates the L1 on it and brings up its validator. `just l1-rpc` prints its RPC URL; every other recipe finds it on its own.

### Part 3: Deploy the same contracts

The admin deploys the Part 1 naive auction, untouched:

```sh
just deploy-naive
```

Note the address it prints: it is `<auction>` below. Now try deploying as Alice:

```sh
just deploy-naive alice        # Transaction Failure
just roles alice               # deploy : none
```

She is invited to bid, not to put her own contracts on the chain. That is the first thing your own chain gives you that Fuji can't.

### Part 4: Carol at the door

Carol has 1000 BRUNCH. She tries to bid:

```sh
just roles carol
just bid <auction> 5ether carol
# cannot issue transaction from non-allow listed address: 0x90F7…b906
```

The node refuses the transaction before it ever reaches the auction. Balance doesn't matter; the allowlist does. The admin can let her in through the transaction allowlist precompile at `0x0200…0002`:

```sh
just allow carol
just bid <auction> 5ether carol    # succeeds
just revoke carol                  # and out again
```

So far, the permissioned chain is doing exactly what it promised.

### Part 5: Bob reads Alice's bid

Alice, who was invited, places her bid:

```sh
just bid <auction> 3ether alice
```

Bob is invited too. He runs the Part 1 attack, unchanged:

```sh
just peek <auction> 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
# bid    : 3000000000000000000 wei  =  3.000000000000000000 BRUNCH
```

The allowlist stops strangers *sending transactions*. Reading storage is not a transaction, and Bob is not a stranger. Your own chain decides who is in the room; it does not hide anything from the people in it. In an auction, the people in the room are exactly the people who must not see your bid.

### Part 6: Commit-reveal still holds

So the Part 1 fix carries over unchanged. Deploy the sealed auction with short phases:

```sh
COMMIT_SECONDS=120 REVEAL_SECONDS=120 just deploy-sealed
```

Each bidder makes a secret salt, builds a commitment locally (that computation never touches the chain) and commits it with the 0.01 BRUNCH deposit:

```sh
just salt                                              # keep the output
just commit <auction> $(just commit-hash alice 3ether <salt>) alice
```

Bob tries `peek` again. Slot 0 of this contract holds commitments, so he finds a hash, not a bid.

Once the commit deadline passes, each bidder reveals the bid and pays it in. Once the reveal deadline passes, anyone can close the auction, and everyone pulls what they are owed: losers their bids, everyone their deposits, the admin the winning bid:

```sh
just reveal <auction> 3ether <salt> alice
just finalise <auction>
just withdraw <auction> alice
just withdraw <auction> admin
```

**Gotcha: a quiet chain has an old clock.** This L1 only makes a block when a transaction arrives. After a quiet commit phase, the latest block is still the one with the last commit in it, so its timestamp is still inside the commit phase. `cast send` estimates gas against that block, and the reveal fails in estimation with `NotInRevealPhase` though the deadline has clearly passed. That is why `reveal` and `finalise` pass a fixed gas limit: it skips estimation, and the transaction lands in a new block stamped with the current time. Part 1 never hit this, because `just anvil` mines a block every second whether or not anything happens.

### Part 7: What the L1 bought, and what it didn't

Check what all of this cost the admin:

```sh
just roles admin               # balance : 999.9999999999996… BRUNCH
```

A bid costs about 90,000 wei. That's not free (every transaction still pays the 1 wei base fee per unit of gas), but nobody needs a faucet. One catch: the node still *suggests* a 150 gwei tip, and wallets take the suggestion. The recipes ask for no tip, which is why they pay almost nothing.

| Your own chain bought | It did not buy |
| --- | --- |
| Who can transact, who can deploy, who validates | Secrecy from anyone already inside |
| Fees the operator chooses | A reason to drop commit-reveal |
| A chain you can reset, upgrade and configure | |

Hashing hides a bid until it is revealed. Hiding it for good takes encryption.

### Looking after the chain

```sh
just l1-stop                   # pause it, keeping its state
just l1-start                  # resume, in seconds
just l1-reset                  # throw it away and boot a fresh one from genesis
```

## Resources

- [Code repository](https://github.com/ahmedali8/avalancheteam1-builders-brunch-workshops/tree/main/packages/sealed-bid-auctions/part2-permissioned-l1)
- [Part 1: Sealed-bid Auctions on a Public Blockchain](../../sealed-bid-auctions/en/README.md)
- [avalanche-cli](https://build.avax.network/docs/tooling/avalanche-cli)
- [Avalanche documentation](https://go.team1.network/docs)
- [Foundry book](https://book.getfoundry.sh)
