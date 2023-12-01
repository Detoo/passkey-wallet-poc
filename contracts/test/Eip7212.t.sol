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
    // P256Verifier was deployed @ 10367893
    uint256 public forkBlock = 10861192;

    // From zk-faceID
    address payable public bundler = payable(0x433711cDa558c0fa32a4b8554939ab8740B9f5AC);
    address public paymaster = 0xc059F997624fd240214c025E8bb5572E7c65182e;
    IEntryPoint public entryPoint = IEntryPoint(payable(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789));
    string public userId = "detoo";
    PasskeyAccountFactory public accountFactory;
    PasskeyAccount public account;

    address public alice = makeAddr("Alice");
    ERC20PresetMinterPauser public token;

    // Passkey
    // Public key should not change as long as we don't roll our Passkey
    bytes credentialId = hex"841e1a8bc82311c7f2455b97ca5abc3c168da964"; // hB4ai8gjEcfyRVuXylq8PBaNqWQ
    uint256 x = 0x2c9629b26f5d542f3a7b9060ac8609bef53f6543b55cf6aa384d5b025f9a17e5;
    uint256 y = 0x771da7f3ade37b5c40cde8586b52dd2358a12381998ab2713866e7ebc78061cd;
    uint256 salt = 0;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("base_goerli"), forkBlock);

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

    function test_handleOps_normal() public {
        // Input parameters.
        bytes memory authenticatorData = hex"49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97631d00000000";
        string memory clientDataPrefix = '{"type":"webauthn.get","challenge":"';
        string memory clientDataPostfix = '","origin":"http://localhost:3000","crossOrigin":false}';
        uint256 r = 0xe55e71693eba7b1daaf56f0e60bbf97ad3a2c3ffa1ba96f1e7b69e2e903dd6bb;
        uint256 s = 0x07781e31ac29800f4f8a451fa5fd663656fce41acbcb81d97a9432b457cee509;

        bytes memory opCalldata = abi.encodeWithSelector(
            account.execute.selector,
            address(token),
            0,
            abi.encodeWithSelector(
                token.transfer.selector,
                alice,
                20 ether
            )
        );

        UserOperation[] memory userOps = new UserOperation[](1);
        userOps[0] = UserOperation({
            sender: address(account),
            nonce: 0,
            initCode: new bytes(0),
            callData: opCalldata,
            callGasLimit: 900000,
            verificationGasLimit: 900000,
            preVerificationGas: 900000,
            maxFeePerGas: 100000050,
            maxPriorityFeePerGas: 100000050,
            paymasterAndData: abi.encodePacked(paymaster),
            signature: abi.encode(
                r,
                s,
                authenticatorData,
                clientDataPrefix,
                clientDataPostfix
            )
        });

        assertEq(token.balanceOf(address(account)), 100 ether);
        assertEq(token.balanceOf(alice), 0 ether);

        vm.prank(bundler);
        entryPoint.handleOps(userOps, bundler);

        assertEq(token.balanceOf(address(account)), 80 ether);
        assertEq(token.balanceOf(alice), 20 ether);
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
