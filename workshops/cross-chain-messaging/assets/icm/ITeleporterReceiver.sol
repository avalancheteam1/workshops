// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// What the ICM Messenger calls on the destination chain to hand over a message.
interface ITeleporterReceiver {
    function receiveTeleporterMessage(bytes32 sourceBlockchainID, address originSenderAddress, bytes calldata message)
        external;
}
