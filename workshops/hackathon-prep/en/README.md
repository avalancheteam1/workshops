# Hackathon Prep with Avalanche

## Overview

This workshop prepares an Avalanche project before an event begins. You start from the event brief, build a small but complete product on Avalanche, and demonstrate verifiable onchain state. It also covers the foundations you need to explain *why* the design works: shared ledgers, hashes, signatures, consensus, the Avalanche Primary Network, and Solidity.

The material is modular. Use the route that fits your session:

- **Opening (short):** Parts 1–2, 5–6, 13. Team1/host intro plus the project and bounty framing.
- **Introductory workshop:** Parts 1–2, 3–8, 9–12, 13. Foundations plus the Fuji and Foundry lab.
- **Developer workshop:** Parts 1–2, 3–12, 13. Adds Foundry deployment and state verification.
- **L1 lab (optional):** Parts 6, 10, 14–15. Requires the Counter project and a prepared test wallet.

## Learning objectives

- Turn an event brief into a scoped project and a demo plan.
- Explain ledgers, hashes, signatures and consensus without overstating them.
- Describe the Avalanche Primary Network, Snowman sampling and validator rules.
- Use Core and Fuji C-Chain with a dedicated test account.
- Compile, test, deploy and call a Solidity contract with Foundry.
- Decide whether a prototype should stay on C-Chain or needs an Avalanche L1.
- Verify a result onchain instead of trusting a UI success message.

## Prerequisites

- Completed [Getting Started with Avalanche](../../getting-started/en/README.md), including a Core wallet on Fuji with test AVAX.
- The event brief: rules, submission format, deadline and judging rubric.
- A terminal, a text editor, and Foundry installed from the [official guide](https://getfoundry.sh/introduction/getting-started/).
- A dedicated test wallet. Never use a wallet that holds real funds in a workshop.

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

### Part 3: From shared ledgers to signed messages (15 min)

A central ledger is maintained by one operator, and users rely on that operator's access and correction policies. A blockchain is different in *who verifies*: nodes independently check transactions, and consensus selects the accepted history. Trust still depends on code, validators and key custody; decentralization depends on the concrete network.

**Hashes** make changes detectable. A cryptographic hash turns any input into a deterministic, fixed-length fingerprint, and the links between blocks reveal edits:

| Property | What a secure hash aims to prevent |
|---|---|
| Preimage resistance | Recovering an unknown input from its hash |
| Second preimage resistance | Replacing a given input with another that has the same hash |
| Collision resistance | Finding any two different inputs with the same hash |

These resistances are computational, not mathematical impossibilities. SHA-256 produces a 256-bit digest. Hash links alone do not prevent history rewrites; consensus makes rewriting costly.

**Digital signatures** authorize messages. A private key signs a message, and the signature binds that authorization to the exact bytes; a public key verifies it. A valid signature proves control of a key. It does not identify a person and does not by itself make a payment final. Bitcoin uses ECDSA and, under Taproot, Schnorr signatures; traditional EVM transactions use ECDSA.

**Signatures need consensus.** Two conflicting transactions can both carry valid signatures: nodes also check balances or unspent outputs and protocol rules, and consensus decides which valid history the network accepts. Bitcoin uses UTXO; the C-Chain uses accounts and nonces. A signature, a valid transaction and a final result are three different things.

### Part 4: Consensus: Bitcoin, Proof of Work and Proof of Stake (15 min)

In Bitcoin, miners assemble transactions and search for a valid block hash. The block header commits to the transactions and the previous block. Nodes verify the rules and follow the valid chain with the most **cumulative work** — not the one with the most nodes or the most blocks. More confirmations reduce reorganization risk; six confirmations are a risk convention, not an absolute guarantee. Modern fees are commonly quoted in sat/vB.

| Question | Proof of Work | Proof of Stake |
|---|---|---|
| What limits influence? | Computational work | Economic stake |
| Who participates? | Miners and verifying nodes | Validators and verifying nodes |
| How is agreement reached? | Chain-selection rules | A network-specific protocol |
| What pays operators? | Subsidies and transaction fees | Network-specific reward rules |

PoW and PoS mainly describe Sybil resistance and participation. Consensus is not identical across PoS networks: do not assume every staked node proposes every block, or that every network applies slashing.

### Part 5: Avalanche, Snowman and validators (20 min)

Avalanche is a network of blockchains for applications and digital assets. The C-Chain runs Ethereum-compatible smart contracts, Avalanche L1s let builders define their own network rules, and AVAX pays transaction fees on the C-Chain. AVAX is the native token, not a stablecoin.

The **Primary Network**, which every validator joins, has three chains:

| Chain | Purpose |
|---|---|
| P-Chain | Validator coordination and Avalanche L1 operations |
| X-Chain | Creation and transfer of Avalanche Native Tokens |
| C-Chain | Solidity contracts and EVM applications — where this workshop builds |

**Snowman** reaches agreement through repeated, stake-weighted sampling: validators verify blocks against the chain's rules, samples query validator preferences, and sufficient repeated agreement leads to acceptance. In the protocol, `k` is the sample size, `alpha` an agreement threshold and `beta` a confidence threshold. Applications should distinguish pending, accepted and failed results. Gossip (propagation) is not consensus (decision), and consensus finality is not the wallet's total response time.

**Validators and stake.** On the Primary Network, AVAX stake weights validator sampling, correct participation matters for rewards, and stake is not slashed under current Primary Network rules. Custom Avalanche L1s are different: each defines its own validator policy, membership can be controlled by Validator Manager contracts, and security depends on that L1's own validator set. Do not apply Primary Network staking rules to every L1.

### Part 6: C-Chain or a custom Avalanche L1? (10 min)

| | C-Chain | Avalanche L1 |
|---|---|---|
| Infrastructure | Shared EVM infrastructure | Own validator and network rules |
| Tooling | Solidity and familiar Ethereum tools | Custom gas economics or execution |
| Cost | Ready to use | Additional infrastructure to operate |

A custom L1 is useful when you need specific network rules, but it adds operational work, and each L1 carries its own security rather than automatically inheriting the Primary Network's. For a typical hackathon prototype, Fuji C-Chain is sufficient.

### Part 7: Smart contracts and Solidity essentials (25 min)

Solidity compiles to bytecode executed by the EVM. A contract stores state and exposes callable functions, transactions can change state and consume gas, and an RPC read can inspect state without sending a transaction. Contracts do not wake up on their own: a call or transaction triggers execution. Code at an address is normally fixed, though proxy architectures can change behavior.

**Types you will use:**

| Type | Example use |
|---|---|
| `uint256` / `int256` | Unsigned / signed integer quantities |
| `bool` | An eligibility flag: true or false |
| `address` | A wallet or contract address |
| `string` / `bytes32` | Text labels / fixed-size identifiers |
| `array` | A list of recipients or asset IDs |
| `mapping(address => uint256)` | A quantity associated with each address |

Solidity is typed and case-sensitive. ERC-20 represents amounts with integers and `decimals`, never floating point. A `mapping` is not an automatically enumerable list.

**Function visibility** (this concerns functions): `public` is callable inside the contract and through its external interface; `external` only through the external interface; `internal` inside the contract and its derived contracts; `private` inside the defining contract only. For state variables, `public` generates a getter but not an automatic setter, and `private` does **not** hide onchain data.

**Reads, writes and value:**

| Declaration | Meaning |
|---|---|
| `view` | Reads state without changing it |
| `pure` | Neither reads nor modifies contract state |
| `payable` | Accepts native value with the call |
| State-changing function | Can update storage and must be transacted to persist |

`view` and `pure` are not a guarantee of zero gas when invoked inside a transaction, and an `eth_call` is an offchain simulation that publishes nothing. `payable` concerns native value — AVAX on the C-Chain, or the L1's native token — not ERC-20 tokens automatically.

**Call and block context:**

| Expression | What it returns |
|---|---|
| `msg.sender` | The immediate caller of this function (may be a contract) |
| `msg.value` | Native value sent with this call, in wei |
| `address(this)` | The current contract address |
| `block.timestamp` | The block timestamp in seconds |
| `block.chainid` | The EVM network's chain ID |

`msg.value` is AVAX in wei on the C-Chain, or the native token on an L1; the `ether` suffix multiplies by 10^18 and does not select a currency. `block.timestamp` is not a safe source of randomness.

### Part 8: Gas and ERC-20 tokens (10 min)

Two different things are in play. **Test AVAX** is the gas asset: it pays C-Chain fees to deploy a contract and send transactions. A **demo ERC-20** is a contract that tracks balances and transfers; it has no monetary value and is not a backed stablecoin. An ERC-20 balance does not pay gas. ERC-20 is a standard, not a promise of a peg, reserves or economic rights.

### Part 9: Core wallet and Fuji setup (10 min)

1. Install Core from its official website or extension listing.
2. Use a dedicated test wallet and secure its recovery method offline.
3. Enable Testnet Mode and select Avalanche Fuji C-Chain.
4. Connect to the Builder Hub faucet and request test AVAX.

| Field | Value |
|---|---|
| Network name | Avalanche Fuji C-Chain |
| RPC URL | `https://api.avax-test.network/ext/bc/C/rpc` |
| Chain ID | `43113` |
| Currency symbol | `AVAX` |
| Explorer | `https://explorer-test.avax.network/c-chain` |

Prepare two test accounts under your own control (sender A and recipient B) before the session. Onboarding screens can change; request AVAX on the correct chain. The optional L1 lab also needs test AVAX on the P-Chain, which is separate from the C-Chain balance. Never put a seed phrase or private key in slides, a repository or a chat.

### Part 10: Build and test a Counter with Foundry (20 min)

Foundry gives you three tools: **Forge** compiles Solidity, runs unit and fuzz tests, deploys contracts and runs scripts; **Cast** reads RPC state and sends contract calls; **Anvil** runs a local EVM network. Install Foundry from the official instructions and reopen your terminal as the installer indicates.

Create a local project and copy the three companion files:

```sh
mkdir -p hackathon-prep/src hackathon-prep/test
cd hackathon-prep
cp /path/to/Counter.sol src/Counter.sol
cp /path/to/Counter.t.sol test/Counter.t.sol
cp /path/to/foundry.toml foundry.toml
forge --version
cast --version
anvil --version
forge build
forge test -v
forge fmt --check
```

The [Counter contract](../assets/Counter.sol) is deliberately open: anyone can change it. Read [Counter.t.sol](../assets/Counter.t.sol) before changing the contract; it covers the initial value, a state change, a fuzzed sequence and overflow behavior, using the pinned `foundry.toml`. Note the distinction: `forge test` executes tests, while `forge script --broadcast` submits transactions.

This is an exercise, not a project template for real funds. The point is to practise the full loop: compile, test, deploy, call and verify state.

### Part 11: Deploy on Fuji C-Chain (20 min)

Use only a dedicated test account. The keystore import prompts for the private key locally; do not show or paste the key into a chat, slides, repository or screen share.

```sh
export AVALANCHE_RPC="https://api.avax-test.network/ext/bc/C/rpc"
cast chain-id --rpc-url "$AVALANCHE_RPC"
# Expected: 43113. Stop if the network differs.

cast wallet import hackathon-demo --interactive
forge create src/Counter.sol:Counter \
  --rpc-url "$AVALANCHE_RPC" \
  --account hackathon-demo --broadcast
```

Save the contract address and transaction hash returned by Foundry. `--broadcast` submits a testnet transaction and consumes test AVAX for gas. These slides are instructions for you, not evidence that a deployment already happened.

### Part 12: Read, write, verify (10 min)

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

A fresh Counter returns `0`; one successful increment changes it to `1`. `cast call` reads without a transaction; `cast send` requires a signature and gas. Check the receipt and the resulting state in the Fuji explorer, not just the terminal output. A successful command alone is not enough evidence for a reviewer.

### Part 13: Turn the exercise into a project (15 min)

Use the Counter only as a starting point. Replace the open `increment()` action with the smallest useful workflow for the event:

- A stablecoin prototype can show a test payment, payroll step, treasury approval or settlement state.
- A tokenized-asset prototype can show issuance, an eligibility or transfer policy, and settlement with test data.
- Any other theme can use the same structure: user action, contract logic, transaction, updated state, and a clear explanation of why Avalanche is part of the solution.

A generic swap interface, or a landing page and dashboard on their own, does not demonstrate a complete flow. Before adding another feature, make the repository usable by someone else: a short README, setup steps, the test command, the deployment command and how to reproduce the demo.

### Part 14: Optional Avalanche L1 lab (30+ min)

Use an Avalanche L1 when the project needs its own network rules, validator policy, fee configuration or execution environment. Decide before you click:

| Decision | Typical workshop choice |
|---|---|
| Execution | Subnet-EVM for familiar Solidity tooling |
| Network | Testnet only |
| Gas | A custom test token and a prefunded account |
| Access | Explicit deployer and transaction permissions |
| Operations | A test node, RPC endpoint and validator setup |

Then work through the Console flow, keeping the identifiers distinct at every step:

1. **Create the subnet.** Connect Core in Testnet Mode, fund the P-Chain operations, create the subnet and save the Subnet ID. This creates the record and control authority on the P-Chain; no blockchain is running yet.
2. **Configure the genesis.** Define the chain name and EVM chain ID, the native token and allocations, gas and fee parameters, allowlists, and any predeployed contracts. EVM chain ID, Blockchain ID and Subnet ID are different identifiers.
3. **Create the chain.** Review the genesis, VM and Subnet ID, then use Create Chain and inspect the wallet transaction. A confirmed transaction does not mean a node is already running the chain.
4. **Start a test node.** Select the subnet under Managed Testnet L1 Nodes, create a test node or follow the Docker path, and wait for a healthy node with a responding RPC endpoint. Managed resources can expire.
5. **Configure validator management.** Review the Validator Manager and the initial validator set, complete the Convert to L1 step, confirm the P-Chain transaction, and initialize the validator set. Conversion is irreversible, so stay on testnet and re-check IDs and validators.
6. **Connect Core to the right chain.** Add the network and check the RPC URL, EVM chain ID, Blockchain ID, Subnet ID and native token symbol before approving. Do not reuse Fuji's `43113` for a custom L1.
7. **Reuse the same Solidity project.** Point Foundry at the new RPC:

```sh
export L1_RPC="<your L1 RPC endpoint>"
cast chain-id --rpc-url "$L1_RPC"
forge create src/Counter.sol:Counter \
  --rpc-url "$L1_RPC" \
  --account hackathon-demo --broadcast
```

Same Solidity code, a different RPC, chain ID, gas token and contract address. Use the newly returned address, and check gas in the native token and allowlist membership if enabled.

**Messaging between L1s (optional, 2 min).** Interchain Messaging (ICM) enables messages between chains: a source contract emits a message and its validators sign it, a relayer delivers it, and the destination verifies the signed message and executes the receiving logic. ICM Contracts, often called Teleporter, provide interfaces and message handling; ICTT is a token-transfer application built on ICM. Verify chain and sender identity, validator configuration and relayer; do not describe it as trustless without assumptions.

### Part 15: When a step fails (10 min)

| Symptom | First check |
|---|---|
| No RPC response | Node status, URL and test-node expiry |
| Deployment reverts | Native gas balance and deployer allowlist |
| Wallet shows no funds | Selected chain and genesis allocation |
| Conversion incomplete | P-Chain receipt, manager and validator initialization |
| Read returns no value | Contract address and bytecode on this exact chain |

On Fuji, wrong network, missing gas and unimported tokens are the common failures: switch to 43113, check the test AVAX balance, and import the token by its contract address. An empty explorer is not by itself proof of failure — query the RPC and check the code at the address. Keep the outputs of each operation, and do not send a second transaction before checking the state of the first.

## Exercises

1. **Project statement.** Write the one-sentence statement for your team and identify the transaction that proves it works.
2. **Hash and signature boundary.** State one thing a valid signature proves and one thing it does not.
3. **Chain ID check.** Call `eth_chainId` and convert the hex result to decimal. Does it match your network table?
4. **Repository handoff.** Ask another participant to follow your README from a clean terminal. Record the first missing instruction they find.
5. **Demo rehearsal.** Present the user problem, complete action, Avalanche integration and proof in the time allowed by the event.
6. **Optional L1 architecture.** Explain one specific requirement that C-Chain cannot meet and how an L1 addresses it. Include the validator and operational tradeoff.

## Next steps

- Build your first browser-connected product with [Build Your First dApp](../../build-your-first-dapp/en/README.md).
- Continue through [Avalanche Academy](https://build.avax.network/academy).
- Use the [Builder Console](https://build.avax.network/console/layer-1/create/create-chain) for an L1 testnet experiment.
- Turn the event brief into a public README before the team begins the final build session.

## Resources

- [Avalanche Academy](https://build.avax.network/academy)
- [Avalanche Builder Hub](https://build.avax.network)
- [Primary Network documentation](https://build.avax.network/docs/primary-network)
- [Avalanche L1 documentation](https://build.avax.network/docs/avalanche-l1s)
- [Snowman consensus](https://build.avax.network/docs/primary-network/avalanche-consensus)
- [Solidity documentation](https://docs.soliditylang.org/en/latest/)
- [Foundry book](https://book.getfoundry.sh)
- [Fuji explorer](https://explorer-test.avax.network/c-chain)
