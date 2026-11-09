// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ITeleporterMessenger, TeleporterMessageInput, TeleporterFeeInfo} from "./icm/ITeleporterMessenger.sol";

/// Lives on chain A. Hands a string to the ICM Messenger, addressed to a contract on another
/// chain. That is the whole job: the Messenger emits a Warp message, the relayer carries it.
contract Sender {
    ITeleporterMessenger public immutable messenger;

    /// Gas for the receiver's handler on the destination chain. Storing a fresh string costs
    /// about 20k per 32-byte slot, so this covers messages a few hundred bytes long.
    uint256 public constant RECEIVE_GAS_LIMIT = 300_000;

    constructor(ITeleporterMessenger messenger_) {
        messenger = messenger_;
    }

    function send(bytes32 destinationBlockchainID, address destination, string calldata text)
        external
        returns (bytes32 messageID)
    {
        messageID = messenger.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: destinationBlockchainID,
                destinationAddress: destination,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: RECEIVE_GAS_LIMIT,
                allowedRelayerAddresses: new address[](0),
                message: abi.encode(text)
            })
        );
    }
}
