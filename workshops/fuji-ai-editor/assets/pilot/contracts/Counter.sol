// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Workshop counter with an explicitly selected owner. It holds no funds.
contract Counter {
    error Unauthorized();
    error InvalidOwner();
    address public owner;
    uint256 public number;
    event NumberChanged(uint256 previous, uint256 current);

    constructor(address initialOwner, uint256 initialValue) {
        if (initialOwner == address(0)) revert InvalidOwner();
        owner = initialOwner;
        number = initialValue;
    }

    function setNumber(uint256 next) external {
        if (msg.sender != owner) revert Unauthorized();
        emit NumberChanged(number, next);
        number = next;
    }
}
