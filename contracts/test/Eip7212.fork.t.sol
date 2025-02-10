// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20PresetMinterPauser} from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import {PasskeyAccountFactory} from "../src/PasskeyAccountFactory.sol";
import {PasskeyAccount} from "../src/PasskeyAccount.sol";
import {Base64Url} from "../src/lib/base64url/Base64Url.sol";
import {ERC20Drip} from "../src/lib/erc20-drip/ERC20Drip.sol";

contract Eip7212ForkTest is Test {
    // PasskeyAccountFactory was deployed @ 21699892
    uint256 public forkBlock = 21699892;

    // From zk-faceID
    address payable public bundler = payable(0x433700890211c1C776C391D414Cffd38efdd1811);
    bytes public paymasterAndData = hex"00000000000000fb866daaa79352cc568a005d9600000067a99e6e00000000000015553754cf8297d30f09493616b8ab0ab95429a16ccc51480808847902dcef1f5c425b30d047d3dace68426f6abbb3cac98fcb0aa5145300a6b888324d524fbf1b";
    IEntryPoint public entryPoint = IEntryPoint(payable(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789));
    PasskeyAccountFactory public accountFactory = PasskeyAccountFactory(0x4CaC72faa1486b1F186EA8850218F8Fe8ed4Be57);
    ERC20Drip public token = ERC20Drip(0x3E4e4d16530FE0AD88C8821eB48268285c3C8F60);
    PasskeyAccount public account;
    bytes public initCode;

    // Passkey
    // Public key should not change as long as we don't roll our Passkey
    bytes credentialId = hex"0b92f071525e71ccae743c7529ac356e1a465f69"; // C5LwcVJeccyudDx1Kaw1bhpGX2k
    uint256 x = 0x5e888f62b508a5ce83b8712b4b48d12e489a08068dc9966c1e48b062fe9728d1;
    uint256 y = 0x8f52ccb451cc4b9b59219df60d183c343ac7af662ea7fab5533f5b98f881d9fa;
    uint256 salt = 0;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("base_sepolia"), forkBlock);

        // From zk-faceID
        vm.label(address(bundler), "Bundler");
        vm.label(address(entryPoint), "IEntryPoint");
    }

    function test_normal() public {
        // Input parameters.
        bytes memory authenticatorData = hex"49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97631d00000000";
        string memory clientDataPrefix = '{"type":"webauthn.get","challenge":"';
        string memory clientDataPostfix = '","origin":"http://localhost:3000","crossOrigin":false}';
        uint256 r = 0xd66354d3c99bc49f7167876705d8791ecc75cab3055e898639e461c2a072a923;
        uint256 s = 0xeb1c6cfe62fa33ece1293f4740aa5fcf1784409c62c3b155462a2388546f0b63;

        account = PasskeyAccount(payable(accountFactory.getAddress(credentialId, x, y, salt)));
        assertEq(address(account), 0x6E5e85AD368d7399bb0E9104d98E4166c0A7Cd94);

        initCode = abi.encodePacked(
            address(accountFactory),
            abi.encodeWithSelector(
                PasskeyAccountFactory.createAccount.selector,
                "test0",
                credentialId,
                x,
                y,
                salt
            )
        );
//        console2.log("initCode:");
//        console2.logBytes(initCode);

        // Call TestToken.drip() as it is the standard procedure after creating a new account
        bytes memory opCalldata = abi.encodeWithSelector(
            account.execute.selector,
            address(token),
            0,
            abi.encodeWithSelector(
                token.drip.selector,
                100 ether
            )
        );
//        console2.log("opCalldata:");
//        console2.logBytes(opCalldata);

        UserOperation[] memory userOps = new UserOperation[](1);
        userOps[0] = UserOperation({
            sender: address(account),
            nonce: 0,
            initCode: initCode,
            callData: opCalldata,
            callGasLimit: 144708,
            verificationGasLimit: 1088334,
            preVerificationGas: 172201,
            maxFeePerGas: 1485712,
            maxPriorityFeePerGas: 1485000,
            paymasterAndData: abi.encodePacked(paymasterAndData),
            signature: abi.encode(
                r,
                s,
                authenticatorData,
                clientDataPrefix,
                clientDataPostfix
            )
        });

        entryPoint.handleOps(userOps, bundler);
    }
}
