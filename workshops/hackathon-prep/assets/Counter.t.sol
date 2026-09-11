// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Counter} from "../src/Counter.sol";

contract CounterTest {
    Counter public counter;

    function setUp() public {
        counter = new Counter();
    }

    function testInitialValue() public view {
        require(counter.number() == 0, "initial value must be zero");
    }

    function testIncrement() public {
        counter.increment();
        require(counter.number() == 1, "increment must update storage");
    }

    function testFuzzSetThenIncrement(uint256 value) public {
        counter.setNumber(value);
        require(counter.number() == value, "setNumber must persist the input");
        if (value < type(uint256).max) {
            counter.increment();
            require(counter.number() == value + 1, "increment after set");
        }
    }

    function testOverflowRevertsAndPreservesState() public {
        counter.setNumber(type(uint256).max);
        (bool success,) = address(counter).call(abi.encodeWithSignature("increment()"));
        require(!success, "overflow must revert");
        require(counter.number() == type(uint256).max, "revert must preserve state");
    }
}
