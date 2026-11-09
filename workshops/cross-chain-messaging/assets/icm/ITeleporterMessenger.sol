// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// The fee a sender offers the relayer that delivers its message. Zero is allowed: the
/// relayer avalanche-cli runs locally delivers for free.
struct TeleporterFeeInfo {
    address feeTokenAddress;
    uint256 amount;
}

struct TeleporterMessageInput {
    bytes32 destinationBlockchainID;
    address destinationAddress;
    TeleporterFeeInfo feeInfo;
    /// Gas the destination chain must give the receiver's `receiveTeleporterMessage`.
    uint256 requiredGasLimit;
    /// Empty means any relayer may deliver.
    address[] allowedRelayerAddresses;
    bytes message;
}

/// The one function of the ICM Messenger (TeleporterMessenger v1.0.0) this workshop calls.
/// avalanche-cli deploys the Messenger at the same address on every chain; the full
/// interface lives in ava-labs/icm-services (icm-contracts/).
interface ITeleporterMessenger {
    function sendCrossChainMessage(TeleporterMessageInput calldata messageInput) external returns (bytes32 messageID);
}
