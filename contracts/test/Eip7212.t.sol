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

contract Eip7212Test is Test {
    // P256Verifier was deployed @ 4307016
    uint256 public forkBlock = 21698974;

    // From zk-faceID
    address payable public bundler = payable(0x433700890211c1C776C391D414Cffd38efdd1811);
    address public paymaster = 0x00000000000000fB866DaAA79352cC568a005D96;
    IEntryPoint public entryPoint = IEntryPoint(payable(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789));
    string public userId = "test0";
    PasskeyAccountFactory public accountFactory;
    PasskeyAccount public account;

    address public alice = makeAddr("Alice");
    ERC20PresetMinterPauser public token;

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
        vm.label(address(paymaster), "PayMaster");
        vm.label(address(entryPoint), "IEntryPoint");

        console2.log("Alice address:");
        console2.logAddress(address(alice));

        accountFactory = new PasskeyAccountFactory(entryPoint);
        vm.label(address(accountFactory), "AccountFactory");
        account = accountFactory.createAccount(userId, credentialId, x, y, salt);

        console2.log("account address:");
        console2.logAddress(address(account));
        vm.label(address(account), "Account");

        // Give account some test tokens.
        token = new ERC20PresetMinterPauser("Test Token", "TEST");
        console2.log("test token address:");
        console2.logAddress(address(token));
        vm.label(address(token), "TestToken");
        token.mint(address(account), 100 ether);
    }

    function test_handleOps_with_initCode_RevertIf_userId_taken() public {
        // Same user ID, but different key
        bytes memory initCode = abi.encodePacked(
            address(accountFactory),
            abi.encodeWithSelector(
                PasskeyAccountFactory.createAccount.selector,
                userId,
                hex"0000000000000000000000000000000000000000",
                123,
                456,
                0
            )
        );

        // Not important since it won't perform this operation.
        bytes memory opCalldata = abi.encodeWithSelector(
            account.execute.selector,
            0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF,
            0,
            ""
        );

        UserOperation[] memory userOps = new UserOperation[](1);
        userOps[0] = UserOperation({
            sender: address(alice), // Not the account
            nonce: 0,
            initCode: initCode,
            callData: opCalldata,
            callGasLimit: 900000,
            verificationGasLimit: 900000,
            preVerificationGas: 900000,
            maxFeePerGas: 100000050,
            maxPriorityFeePerGas: 100000050,
            paymasterAndData: abi.encodePacked(paymaster),
        // Not important since operation won't reach signature verification.
            signature: abi.encode(
                0,
                0,
                "",
                "",
                ""
            )
        });

        vm.prank(bundler);
        vm.expectRevert(abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA14 initCode must return sender"));
        entryPoint.handleOps(userOps, bundler);
    }

    function test_getSenderAddress_normal_after_account_creation() public {
        bytes memory initCode = abi.encodePacked(
            address(accountFactory),
            abi.encodeWithSelector(
                PasskeyAccountFactory.createAccount.selector,
                userId,
                credentialId,
                x,
                y,
                salt
            )
        );
        vm.expectRevert(abi.encodeWithSelector(IEntryPoint.SenderAddressResult.selector, address(account)));
        entryPoint.getSenderAddress(initCode);
    }

    function test_createAccount_same_address_if_userId_taken() public {
        PasskeyAccountFactory.User memory user = accountFactory.getUser(userId);
        assertEq(user.credentialId, credentialId);
        assertEq(user.x, x);
        assertEq(user.y, y);
        assertEq(user.salt, salt);

        PasskeyAccount newAccount = accountFactory.createAccount(userId, credentialId, x, y, salt);
        assertEq(address(newAccount), address(account));
    }

    function test_reverse_userId_lookup() public {
        address userAddress = accountFactory.getAddress(
            credentialId,
            x,
            y,
            salt
        );

        assertEq(
            accountFactory.getUserId(userAddress),
            userId
        );
    }
}
