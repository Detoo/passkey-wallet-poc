// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import { Base64Url } from "../base64url/Base64Url.sol";

/**
 * Helper library for external contracts to verify P256 signatures.
 **/
library P256 {
    struct Message {
        bytes payload;
        bytes authenticatorData;
        string clientDataPrefix;
        string clientDataPostfix;
    }

    address constant VERIFIER = 0xc2b78104907F722DABAc4C69f826a522B2754De4;

    function verifySignatureAllowMalleability(
        bytes32 message_hash,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) public view returns (bool) {
        bytes memory args = abi.encode(message_hash, r, s, x, y);
        (bool success, bytes memory ret) = VERIFIER.staticcall(args);
        assert(success); // never reverts, always returns 0 or 1

        return abi.decode(ret, (uint256)) == 1;
    }

    /// P256 curve order n/2 for malleability check
    uint256 constant P256_N_DIV_2 =
        57896044605178124381348723474703786764998477612067880171211129530534256022184;

    function verifySignature(
        bytes32 message_hash,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) public view returns (bool) {
        // check for signature malleability
        if (s > P256_N_DIV_2) {
            return false;
        }

        return verifySignatureAllowMalleability(message_hash, r, s, x, y);
    }

    //
    // Helpers for verifying arbitrary payloads
    //

    function verifySignatureAllowMalleability(
        Message calldata message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) public view returns (bool) {
        // Reconstruct client data.
        string memory payloadBase64 = Base64Url.encode(message.payload);
        bytes memory clientData = bytes(string.concat(message.clientDataPrefix, payloadBase64, message.clientDataPostfix));

        // Reconstruct hashed message.
        bytes32 hashedClientData = sha256(clientData);
        bytes memory preimage = bytes.concat(message.authenticatorData, hashedClientData);
        bytes32 hashedMessage = sha256(preimage);

        // Verify hashed message against signatures. Note we ignore signature malleability for now.
        return verifySignatureAllowMalleability(hashedMessage, r, s, x, y);
    }

    function verifySignature(
        Message calldata message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) public view returns (bool) {
        // check for signature malleability
        if (s > P256_N_DIV_2) {
            return false;
        }

        return verifySignatureAllowMalleability(message, r, s, x, y);
    }
}
