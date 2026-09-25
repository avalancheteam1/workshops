# Sealed-bid Auctions on a Public Blockchain

## Overview

You build a first-price sealed-bid auction in two steps: every bidder submits one hidden offer, and the highest wins and pays what they bid. The first version is the obvious one. You break it live by reading every "sealed" bid straight out of contract storage. The second version fixes it properly with commit-reveal, deposits that make silence expensive, commitments bound to the bidder, and pull refunds.

> **Public vs private is not about secrecy. It is about who is in the room.**

This is Part 1 of a two-part workshop and runs on a public chain (local anvil, then optionally Fuji), where anyone can read the bids. The two contracts are in [`assets/`](../assets/). The full project (tests, deploy scripts, justfile) and the slides live in the [code repository](https://github.com/ahmedali8/avalancheteam1-builders-brunch-workshops/tree/main/packages/sealed-bid-auctions).

## Learning objectives

- Explain why `private` in Solidity is a visibility rule, not encryption.
- Read a contract's storage slot directly with `cast` and recover a value it never exposes.
- Build a commit-reveal scheme and explain what each part defends against: the hash, the deposit, the bidder binding, and the salt.
- Use pull payments so one misbehaving receiver cannot block everyone else.

## Prerequisites

- Completed [Getting Started with Avalanche](../../getting-started/en/README.md).
- Comfortable reading Solidity and running Foundry tests.
- [Foundry](https://book.getfoundry.sh) (`forge`, `cast`, `anvil`): `curl -L https://getfoundry.sh/install | bash && foundryup`
- [Bun](https://bun.com/docs/installation): `curl -fsSL https://bun.sh/install | bash`
- [just](https://just.systems/man/en/packages.html), the task runner: `brew install just`
- For the optional Fuji part: a **throwaway** wallet funded from the [Fuji faucet](https://go.team1.network/faucet). Never use a wallet that holds real funds in a workshop.

## Workshop

### Part 1: Get the code and run the tests

```sh
git clone https://github.com/ahmedali8/avalancheteam1-builders-brunch-workshops
cd avalancheteam1-builders-brunch-workshops
bun install                    # one install at the root covers every package
cd packages/sealed-bid-auctions/part1-public-blockchain
just test                      # 20 tests
just test-attacks              # just the attacks: they pass, meaning they work
```

Solidity dependencies are bun-managed: run `bun install`, never `forge install`.

### Part 2: The naive auction

Open [`NaiveAuction.sol`](../assets/NaiveAuction.sol). Bidders call `submitBid(amount)`, the amounts sit in a `private` mapping, and after the deadline `winner()` returns the highest bid. The event deliberately does not log the amount.

The tests pass and the contract is still broken:

```sh
forge test --match-contract NaiveAuctionTest -vv
```

`private` only stops *other contracts* reading a value. Every storage slot is readable by anyone with an RPC endpoint. `sealedBid` is the first declared storage variable, so it lives at slot 0, and Solidity stores `sealedBid[bidder]` at `keccak256(bidder . 0)`. The immutables above it are baked into bytecode and take no slot.

### Part 3: Break it live

Start a local node and deploy the naive auction:

```sh
just anvil                     # terminal 1: local node, 1s block time
just deploy-naive-local        # terminal 2: prints "NaiveAuction deployed at: 0x…"
```

Bid 3 ETH as anvil account #1, then read the "sealed" bid back out of storage:

```sh
just bid-local <auction> 3000000000000000000
just peek <auction> 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

`peek` prints the storage slot, the raw word, and the bid in ETH. An attacker who reads every bid can wait until the last moment and outbid the leader by one wei. `test_Attack_MalloryReadsEveryBidAndWinsByOneWei` shows exactly that.

The keys used here are anvil's public, deterministic dev keys. They only exist on local nodes.

### Part 4: Fix it with commit-reveal

Open [`SealedBidAuction.sol`](../assets/SealedBidAuction.sol). Bidding now has two phases:

1. **Commit.** Each bidder submits `keccak256(abi.encode(bidder, amount, salt))` with a 0.01 ETH deposit. Storage discloses nothing while bidding is open.
2. **Reveal.** After the commit deadline, each bidder reveals `amount` and `salt` and pays the bid. The contract checks the hash, returns the deposit, and escrows only the current leader's money.

Each fix closes a specific hole, and each has a test that proves it:

- **Deposit.** A bidder who never reveals forfeits the deposit to the seller, so the revealed set matches the committed set.

  ```sh
  forge test --match-test test_Fixed_NonRevealerForfeitsDepositToSeller -vv
  ```

- **Bound to the bidder.** The hash covers `msg.sender`, so a copied commitment is worthless to the copier.

  ```sh
  forge test --match-test test_Fixed_StolenCommitmentIsWorthless -vv
  ```

- **Pull refunds.** Every refund is credited to a balance its owner withdraws. A push refund would let one bidder with a reverting `receive()` block the whole auction.

Use an unguessable salt. Plausible bids are a small set, so a guessable salt makes the commitment brute-forcible.

### Part 5: Run commit-reveal on anvil

Deploy with short phases so you can finish inside the session:

```sh
COMMIT_SECONDS=120 REVEAL_SECONDS=120 just deploy-sealed-local
```

As anvil account #2, generate a salt, compute the commitment locally, and commit:

```sh
just salt                      # keep the output: without it you cannot reveal
just commit-hash 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC 3000000000000000000 <salt>

cast send <auction> "commit(bytes32)" <hash> --value 0.01ether \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

`commit-hash` never touches the chain. Computing it in a transaction would publish the bid and salt in calldata.

Run `just peek` against this auction: there is nothing useful to read. Once the commit phase closes, reveal and pay the bid:

```sh
cast send <auction> "reveal(uint256,bytes32)" 3000000000000000000 <salt> --value 3ether \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

After the reveal phase, anyone can call `finalise()` to credit the seller and `sweepDeposit(bidder)` for bidders who stayed silent. Everyone collects what they are owed with `withdraw()`.

### Optional: Run it on Fuji

The same attack works on a public network. From the package folder:

```sh
just wallet-import             # paste a THROWAWAY key once, set a password
cp .env.example .env           # set DEPLOYER_ADDRESS to the printed address
just deploy-naive-fuji-live
```

Have someone bid from their own wallet, then read their bid from anywhere:

```sh
cast send <auction> "submitBid(uint256)" 3000000000000000000 \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc --account <their-keystore>
just peek <auction> <bidder> https://api.avax-test.network/ext/bc/C/rpc
```

## Exercises

1. **Guess the salt.** Commit with the salt `0x0` and a bid of 1, 2, or 3 ETH. Write a short loop with `cast keccak` that recovers the bid from the commitment.
2. **Push vs pull.** Change `reveal` to send the outgoing leader their refund directly. Write a test with a bidder whose `receive()` reverts, and watch the auction lock up.
3. **Gotcha.** `vm.prank` applies to the very next call only. In `test/SealedBidAuction.t.sol`, why does reading `auction.DEPOSIT()` inline between the prank and the target call break the test? See the comment on `deposit`.

## Next steps

- Part 2 runs the same auction on a permissioned Avalanche L1, where the question becomes who is in the room rather than what is encrypted. Coming later.

## Resources

- [Slides](https://github.com/ahmedali8/avalancheteam1-builders-brunch-workshops/blob/main/packages/sealed-bid-auctions/part1-public-blockchain/builders-brunch-20260923.pdf)
- [Code repository](https://github.com/ahmedali8/avalancheteam1-builders-brunch-workshops/tree/main/packages/sealed-bid-auctions)
- [Solidity: layout of state variables in storage](https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html)
- [Foundry book](https://book.getfoundry.sh)
- [Snowtrace testnet](https://testnet.snowtrace.io)
- [Fuji faucet](https://go.team1.network/faucet)
- [Avalanche documentation](https://go.team1.network/docs)
