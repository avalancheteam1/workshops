// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ITeleporterReceiver} from "./icm/ITeleporterReceiver.sol";

/// Lives on chain B. Keeps the last message that arrived over ICM.
contract Receiver is ITeleporterReceiver {
    address public immutable messenger;

    string public lastMessage;
    bytes32 public lastSourceBlockchainID;
    /// The contract that sent the message on the source chain: the Sender, not the person
    /// who called it.
    address public lastOriginSender;
    uint256 public received;

    event MessageReceived(bytes32 indexed sourceBlockchainID, address indexed originSender, string text);

    error OnlyMessenger();

    constructor(address messenger_) {
        messenger = messenger_;
    }

    function receiveTeleporterMessage(bytes32 sourceBlockchainID, address originSenderAddress, bytes calldata message)
        external
    {
        // The Messenger only calls us with a message the chain's Warp precompile verified
        // against chain A's validators, after its own checks on origin and replay. Anyone else
        // calling in could claim any source chain and any sender.
        if (msg.sender != messenger) revert OnlyMessenger();

        string memory text = abi.decode(message, (string));
        lastMessage = text;
        lastSourceBlockchainID = sourceBlockchainID;
        lastOriginSender = originSenderAddress;
        received++;

        emit MessageReceived(sourceBlockchainID, originSenderAddress, text);
    }
}
