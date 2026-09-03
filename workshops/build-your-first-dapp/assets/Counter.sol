// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Counter - the smallest useful contract
/// @notice Anyone can increment; only the deployer can reset.
contract Counter {
    uint256 public count;
    address public immutable owner;

    event Incremented(address indexed by, uint256 newCount);

    constructor() {
        owner = msg.sender;
    }

    function increment() external {
        count += 1;
        emit Incremented(msg.sender, count);
    }

    function reset() external {
        require(msg.sender == owner, "only owner");
        count = 0;
    }
}
