# Hackathon Prep with Avalanche

## Overview

This workshop helps you prepare an Avalanche project before an event begins. You turn an event brief into a small, complete build: a clear user problem, a public repository, a runnable contract, a Fuji deployment, and a demo that shows the resulting onchain state. The companion Team1 presentation follows the same sequence and uses Team1 Design System 2.1; the workshop content and source code live here so teams can reuse them across events.

## Learning objectives

- Turn an event brief into a scoped project and a demo plan.
- Explain the role of hashes, signatures, consensus and the Avalanche Primary Network.
- Use Core and Fuji C-Chain with a dedicated test account.
- Compile, test, deploy and call a Solidity contract with Foundry.
- Decide whether a prototype should stay on C-Chain or needs an Avalanche L1.

## Prerequisites

- Completed [Getting Started with Avalanche](../../getting-started/en/README.md), including a Core wallet on Fuji with test AVAX.
- A terminal, a text editor, and Foundry installed from the [official guide](https://getfoundry.sh/introduction/getting-started/).
- A dedicated test wallet. Never use a wallet that holds real funds in a workshop.
- The event brief, including its rules, submission format, deadline and judging rubric.

## Workshop

### Part 1: Read the event brief (10 min)

Read the brief before choosing a stack or a feature. Write down:

- The user or community problem the project should address.
- The required integration, deliverables and submission format.
- The deadline and any rules around team size, eligibility, licenses or existing work.
- The evidence a reviewer should see in the demo.

Treat this list as the project boundary. The event organizer defines the rules; this workshop does not replace them.

### Part 2: Define one complete flow (15 min)

Write a one-sentence project statement in this form:

> For **[user]**, enable **[action]** so they can achieve **[outcome]**, with **[Avalanche component]** providing the verifiable state change.

Then list the shortest route from user action to proof:

1. The user starts an action in the interface or terminal.
2. The app prepares and signs a transaction on Fuji C-Chain.
3. The contract changes state or transfers a test asset.
4. The demo shows the receipt, resulting state and repository instructions.

Avoid building a landing page before this path works. A compact, reliable action teaches more than a broad prototype with no verifiable result.

### Part 3: Build and test a Counter (20 min)

Create a local Foundry project and copy the three companion files into its usual structure:

```sh
mkdir -p hackathon-prep/src hackathon-prep/test
cd hackathon-prep
cp /path/to/Counter.sol src/Counter.sol
cp /path/to/Counter.t.sol test/Counter.t.sol
cp /path/to/foundry.toml foundry.toml
forge build
forge test -v
forge fmt --check
```

The [Counter contract](../assets/Counter.sol) is deliberately open: anyone can update it. Its tests cover the initial value, a state change, a fuzzed sequence, and overflow behavior. Read [Counter.t.sol](../assets/Counter.t.sol) before changing the contract.

This is an exercise, not a project template for real funds. The point is to practice the full loop: compile, test, deploy, call, and verify state.

### Part 4: Deploy on Fuji C-Chain (20 min)

Use only a dedicated test account. The keystore import prompts for the private key locally; do not show or paste the key into a chat, slides, repository or screen share.

```sh
export AVALANCHE_RPC="https://api.avax-test.network/ext/bc/C/rpc"
cast chain-id --rpc-url "$AVALANCHE_RPC"
# Expected: 43113. Stop if the network differs.

cast wallet import hackathon-demo
forge create src/Counter.sol:Counter \
  --rpc-url "$AVALANCHE_RPC" \
  --account hackathon-demo --broadcast
```

Save the contract address and transaction hash returned by Foundry. Broadcasting sends a testnet transaction and consumes test AVAX for gas.

### Part 5: Read, write, verify (10 min)

Set `COUNTER` to the address returned by your own deployment:

```sh
export COUNTER=0x...

cast call "$COUNTER" "number()(uint256)" \
  --rpc-url "$AVALANCHE_RPC"
cast send "$COUNTER" "increment()" \
  --rpc-url "$AVALANCHE_RPC" --account hackathon-demo
cast call "$COUNTER" "number()(uint256)" \
  --rpc-url "$AVALANCHE_RPC"
```

A fresh Counter returns `0`; one successful increment changes it to `1`. Check the transaction receipt and the resulting state in the [Fuji explorer](https://explorer-test.avax.network/c-chain). A successful command alone is not enough evidence for a reviewer.

### Part 6: Turn the exercise into a project (15 min)

Use the Counter only as a starting point. Replace the open `increment()` action with the smallest useful workflow for the event:

- A stablecoin prototype can show a test payment, payroll step, treasury approval or settlement state.
- A tokenized-asset prototype can show issuance, eligibility, transfer or settlement with test data.
- Any other theme can use the same structure: user action, contract logic, transaction, updated state, and a clear explanation of why Avalanche is part of the solution.

Before adding another feature, make the repository usable by someone else. Include a short README, setup steps, the test command, the deployment command, and how to reproduce the demo.

### Part 7: Optional Avalanche L1 lab (30+ min)

Use an Avalanche L1 when the project needs its own network rules, validator policy, fee configuration or execution environment. A typical hackathon prototype can stay on Fuji C-Chain.

For an L1 testnet lab, use Builder Console to:

1. Create a subnet and save its Subnet ID.
2. Define the chain and genesis, including an EVM chain ID, native token allocations and any access controls.
3. Create the chain, start a managed testnet node or use the Docker route, and wait for an RPC endpoint.
4. Configure validator management and complete conversion to an L1.
5. Add the network to Core, check the native gas balance, then deploy the same Counter against the new RPC.

Keep the chain ID, Blockchain ID, Subnet ID, RPC URL, native token and validator configuration distinct. Rehearse the Console workflow before showing it to participants. Do not reuse the Fuji contract address or balance on the L1.

## Exercises

1. **Project statement.** Write the one-sentence statement for your team and identify the transaction that proves it works.
2. **Repository handoff.** Ask another participant to follow your README from a clean terminal. Record the first missing instruction they find.
3. **Demo rehearsal.** Present the user problem, complete action, Avalanche integration and proof in the time allowed by the event.
4. **Optional L1 architecture.** Explain one specific requirement that C-Chain cannot meet and how an L1 addresses it. Include the validator and operational tradeoff.

## Next steps

- Build your first browser-connected product with [Build Your First dApp](../../build-your-first-dapp/en/README.md).
- Continue through [Avalanche Academy](https://build.avax.network/academy).
- Use the [Builder Console](https://build.avax.network/console/layer-1/create/create-chain) for an L1 testnet experiment.
- Turn the event brief into a public README before the team begins the final build session.

## Resources

- [Team1 Design System 2.1](https://github.com/avalancheteam1/design-system/releases/tag/v2.1.0)
- [Avalanche Academy](https://build.avax.network/academy)
- [Avalanche Builder Hub](https://build.avax.network)
- [Avalanche L1 documentation](https://build.avax.network/docs/avalanche-l1s)
- [Foundry book](https://book.getfoundry.sh)
- [Solidity documentation](https://docs.soliditylang.org/en/latest/)
- [Fuji explorer](https://explorer-test.avax.network/c-chain)
