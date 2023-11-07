// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20PresetMinterPauser } from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import { PasskeyAccountFactory } from "../src/PasskeyAccountFactory.sol";
import { PasskeyAccount } from "../src/PasskeyAccount.sol";
import { Base64Url } from "../src/lib/base64url/Base64Url.sol";

contract Eip7212ForkTest is Test {
    // PasskeyAccountFactory was deployed @ 11415850
    uint256 public forkBlock = 11415850;

    // From zk-faceID
    address payable public bundler = payable(0x433711cDa558c0fa32a4b8554939ab8740B9f5AC);
    address public paymaster = 0xc059F997624fd240214c025E8bb5572E7c65182e;
    IEntryPoint public entryPoint = IEntryPoint(payable(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789));
    PasskeyAccountFactory public accountFactory = PasskeyAccountFactory(0x70e8b15F2f0D4e4162D899f0c69831B2Fb7EE8d7);
    PasskeyAccount public account;
    bytes public initCode;

    // Passkey
    // Public key should not change as long as we don't roll our Passkey
    bytes credentialId = hex"56e0a5028e1be67d90acf86bc35af61f566df146"; // VuClAo4b5n2QrPhrw1r2H1Zt8UY
    uint256 x = 0xa453018e06cbb1a3e98954b840c76262c388e417875d264a0732f426a5ea93a8;
    uint256 y = 0xf46a79e0f01607982071ed2ded3d7b3eb51b6c0715cdbcacad60ec31db7be48f;
    uint256 salt = 0;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("base_goerli"), forkBlock);

        // From zk-faceID
        vm.label(address(bundler), "Bundler");
        vm.label(address(paymaster), "PayMaster");
        vm.label(address(entryPoint), "IEntryPoint");
    }

    function test_normal() public {
        // Input parameters.
        bytes memory authenticatorData = hex"49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97631d00000000";
        string memory clientDataPrefix = '{"type":"webauthn.get","challenge":"';
        string memory clientDataPostfix = '","origin":"http://localhost:3000"}';
        uint256 r = 0x14df63c42efb9ae0b0bb129cba900a82816d4656a86cbdcb3dc2488a5c8d4682;
        uint256 s = 0x347ff787fd96ff6952c2b735b5852badcb00f9c3b175374612a6e74de0893226;

        account = PasskeyAccount(payable(accountFactory.getAddress(credentialId, x, y, salt)));
        assertEq(address(account), 0x45dffffab7eE28aD0C2D58311f91726cd8F5D3D3);

        initCode = abi.encodePacked(
            address(accountFactory),
            abi.encodeWithSelector(
                PasskeyAccountFactory.createAccount.selector,
                "test1",
                credentialId,
                x,
                y,
                salt
            )
        );

        // Send 0 ether to itself.
        bytes memory opCalldata = abi.encodeWithSelector(
            account.execute.selector,
            address(account),
            0,
            ""
        );
        console2.log("opCalldata:");
        console2.logBytes(opCalldata);

        UserOperation[] memory userOps = new UserOperation[](1);
        userOps[0] = UserOperation({
            sender: address(account),
            nonce: 0,
            initCode: initCode,
            callData: opCalldata,
            callGasLimit: 900000,
            verificationGasLimit: 900000,
            preVerificationGas: 900000,
            maxFeePerGas: 126499994,
            maxPriorityFeePerGas: 126499994,
            paymasterAndData: abi.encodePacked(paymaster),
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
