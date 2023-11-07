// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "../src/lib/erc20-drip/ERC20Drip.sol";

contract DeployTestToken is Script {
    function run() public {
        vm.startBroadcast(vm.envUint("DEPLOYER_PK"));

        ERC20Drip token = new ERC20Drip("Test Token", "TEST");
        console2.log("test token address:");
        console2.logAddress(address(token));

        vm.stopBroadcast();
    }
}
