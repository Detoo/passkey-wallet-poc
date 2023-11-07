// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import { ERC20Drip } from "../src/lib/erc20-drip/ERC20Drip.sol";

contract ERC20DripTest is Test {
    address public alice = makeAddr("Alice");
    ERC20Drip public token;

    function setUp() public {
        token = new ERC20Drip("Test Token", "TEST");
    }

    function test_drip_normal() public {
        assertEq(token.balanceOf(alice), 0 ether);
        vm.prank(alice);
        token.drip(123 ether);
        assertEq(token.balanceOf(alice), 123 ether);
    }
}
