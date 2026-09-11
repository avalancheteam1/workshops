// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Teaching example: anyone can change the counter. It does not manage funds.
contract Counter {
    uint256 public number;

    function setNumber(uint256 next) public {
        number = next;
    }

    function increment() public {
        number++;
    }
}
