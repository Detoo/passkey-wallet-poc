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
    // PasskeyAccountFactory was deployed @ 13146696
    uint256 public forkBlock = 13146696;

    // From zk-faceID
    address payable public bundler = payable(0x433711cDa558c0fa32a4b8554939ab8740B9f5AC);
    bytes public paymasterAndData = hex"3Ac456E5ffFaA35787315037300CDd33387125B800000000000000000000000000000000000000000000000000000000656aab8b00000000000000000000000000000000000000000000000000000000000000000ef62257be414d3ac07eeee8abfc7ce0faa6769a41370b47829f7b75f69cb7c76bb03c14ee11c9dcb013c5b0da55d4b85ac0c4ee91e35b9a3f07ffd38ec298351b";
    IEntryPoint public entryPoint = IEntryPoint(payable(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789));
    PasskeyAccountFactory public accountFactory = PasskeyAccountFactory(0x63A28A5A169aA1b4650759CfEED8597ce7Ba5910);
    ERC20Drip public token = ERC20Drip(0xb8c7A8A40BF6A0eF68e8611a337eFc45178BDe8b);
    PasskeyAccount public account;
    bytes public initCode;

    // Passkey
    // Public key should not change as long as we don't roll our Passkey
    bytes credentialId = hex"b7158568f4c67f0b7ff1490c0fdb5d0bb4df0f06"; // txWFaPTGfwt_8UkMD9tdC7TfDwY
    uint256 x = 0x54ede609d66d592a933acf56c47a47a26feca7c0fd701ea3474ae5acee1e0b6f;
    uint256 y = 0xb66a2da9e308bd616e2a9ca4e2b957abac50e96b54c4c77e0367c69f8ed8dfe7;
    uint256 salt = 0;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("base_goerli"), forkBlock);

        // From zk-faceID
        vm.label(address(bundler), "Bundler");
        vm.label(address(entryPoint), "IEntryPoint");
    }

    function test_normal() public {
        // Input parameters.
        bytes memory authenticatorData = hex"49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97631d00000000";
        string memory clientDataPrefix = '{"type":"webauthn.get","challenge":"';
        string memory clientDataPostfix = '","origin":"http://localhost:3000","crossOrigin":false}';
        uint256 r = 0x02006d22807d41c08b9fd35c0a3903fb654ba92bd252dcbc5ce5577f8b644890;
        uint256 s = 0x3b5d58e71565f7ddd17ab2f3a65c23481852d7368c87e1c782e2bcd7bcd56e62;

        account = PasskeyAccount(payable(accountFactory.getAddress(credentialId, x, y, salt)));
        assertEq(address(account), 0xF52ccfa3e52a1E2bf0949A2D1BDE147f029a1506);

        initCode = abi.encodePacked(
            address(accountFactory),
            abi.encodeWithSelector(
                PasskeyAccountFactory.createAccount.selector,
                "alice",
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
            callGasLimit: 255362,
            verificationGasLimit: 1095055,
            preVerificationGas: 51880,
            maxFeePerGas: 172758756,
            maxPriorityFeePerGas: 172758756,
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
