// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "../src/PasskeyAccountFactory.sol";

contract DeployPasskeyAccountFactory is Script {
    IEntryPoint entryPoint = IEntryPoint(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789);

    function run() public {
        vm.startBroadcast(vm.envUint("DEPLOYER_PK"));

        PasskeyAccountFactory accountFactory = new PasskeyAccountFactory(entryPoint);
        console2.log("PasskeyAccountFactory address:");
        console2.logAddress(address(accountFactory));

        vm.stopBroadcast();
    }
}
