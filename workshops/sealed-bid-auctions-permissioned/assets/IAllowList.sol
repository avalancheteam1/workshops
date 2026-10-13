// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @title  IAllowList — the interface to Subnet-EVM's allowlist precompiles
/// @notice The L1's "who is in the room" rules. A precompile is not a contract anyone deployed: it is Go code
///         inside the node, answering at a fixed address. There is no Solidity behind it and no bytecode at the
///         address — this interface is only how Solidity (and `cast`) talks to it.
/// @dev    Matches the ABI embedded in Subnet-EVM v0.8.0, the version `just l1-up` runs. Two precompiles share
///         it, each switched on and seeded in l1/genesis.json:
///
///             TX_ALLOW_LIST                 who may send a transaction at all
///             CONTRACT_DEPLOYER_ALLOW_LIST  who may deploy a contract
///
///         Only an admin (or a manager, for non-admin roles) can change a role. Every change emits {RoleSet}.
interface IAllowList {
    /// @notice A role changed.
    /// @param role    The new role.
    /// @param account Whose role changed.
    /// @param sender  Who changed it.
    /// @param oldRole The role before.
    event RoleSet(uint256 indexed role, address indexed account, address indexed sender, uint256 oldRole);

    /// @notice Make `addr` an admin: it may use the precompile, and grant or revoke any role.
    function setAdmin(address addr) external;

    /// @notice Make `addr` a manager: it may use the precompile, and grant or revoke the enabled role.
    function setManager(address addr) external;

    /// @notice Let `addr` use the precompile — for the tx allowlist, send transactions.
    function setEnabled(address addr) external;

    /// @notice Remove every role from `addr`.
    function setNone(address addr) external;

    /// @notice `addr`'s role: one of the ROLE_* constants below.
    function readAllowList(address addr) external view returns (uint256 role);
}

/// @dev Who may send a transaction. `just allow` and `just revoke` call this one.
IAllowList constant TX_ALLOW_LIST = IAllowList(0x0200000000000000000000000000000000000002);

/// @dev Who may deploy a contract.
IAllowList constant CONTRACT_DEPLOYER_ALLOW_LIST = IAllowList(0x0200000000000000000000000000000000000000);

uint256 constant ROLE_NONE = 0;
uint256 constant ROLE_ENABLED = 1;
uint256 constant ROLE_ADMIN = 2;
uint256 constant ROLE_MANAGER = 3;
