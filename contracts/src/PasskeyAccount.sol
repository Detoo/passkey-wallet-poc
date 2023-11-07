// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/samples/SimpleAccount.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

import { P256 } from "../src/lib/p256-verifier/P256.sol";
import { Base64Url } from "../src/lib/base64url/Base64Url.sol";

/**
 * Account that validates P-256 signature for UserOperations.
 */
contract PasskeyAccount is Initializable, SimpleAccount {
    IEntryPoint public _entryPoint;
    bytes public credentialId;
    uint256 public x;
    uint256 public y;

    event PasskeyAccountInitialized(IEntryPoint indexed entryPoint, bytes indexed credentialId, uint256 x, uint256 y);

    constructor(IEntryPoint _newEntryPoint) SimpleAccount(_newEntryPoint) {}

    function initialize(bytes calldata _credentialId, uint256 _x, uint256 _y) public virtual initializer {
        _initialize(_credentialId, _x, _y);
    }

    function _initialize(bytes calldata _credentialId, uint256 _x, uint256 _y) internal virtual {
        credentialId = _credentialId;
        x = _x;
        y = _y;
        emit PasskeyAccountInitialized(_entryPoint, _credentialId, _x, _y);
    }

    /// @inheritdoc BaseAccount
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view override returns (uint256 validationData) {
        (
            uint256 r,
            uint256 s,
            bytes memory authenticatorData,
            string memory clientDataPrefix,
            string memory clientDataPostfix
        ) = abi.decode(userOp.signature, (uint256, uint256, bytes, string, string));

        if (P256.verifySignatureAllowMalleability(
            P256.Message({
                payload: bytes.concat(userOpHash),
                authenticatorData: authenticatorData,
                clientDataPrefix: clientDataPrefix,
                clientDataPostfix: clientDataPostfix
            }),
            r, s, x, y
        )) {
            return 0;
        } else {
            return SIG_VALIDATION_FAILED;
        }
    }

    function getCredentialIdBase64() public view returns (string memory) {
        return Base64Url.encode(credentialId);
    }
}
