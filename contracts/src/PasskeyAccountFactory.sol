// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "./PasskeyAccount.sol";

/**
 * A sample factory contract for PasskeyAccount
 * A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
 * The factory's createAccount returns the target account address even if it is already installed.
 * This way, the entryPoint.getSenderAddress() can be called either before or after the account is created.
 */
contract PasskeyAccountFactory {
    struct User {
        bytes credentialId;
        uint256 x;
        uint256 y;
        uint256 salt;
    }

    PasskeyAccount public immutable accountImplementation;
    IEntryPoint public immutable entryPoint;

    mapping(string => User) public _userMap; // userId -> User
    mapping(address => string) public _userIdMap; // userAddress -> userId

    constructor(IEntryPoint _entryPoint) {
        accountImplementation = new PasskeyAccount(_entryPoint);
        entryPoint = _entryPoint;
    }

    /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createAccount(
        string calldata userId,
        bytes calldata credentialId,
        uint256 x,
        uint256 y,
        uint256 salt
    ) public returns (PasskeyAccount ret) {
        address addr = getAddress(credentialId, x, y, salt);

        if (_userMap[userId].credentialId.length > 0) {
            return PasskeyAccount(payable(addr));
        }

        uint codeSize = addr.code.length;
        if (codeSize > 0) {
            return PasskeyAccount(payable(addr));
        }
        ret = PasskeyAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(
                        PasskeyAccount.initialize,
                        (credentialId, x, y)
                    )
                )
            )
        );
        _userMap[userId] = User({
            credentialId: credentialId,
            x: x,
            y: y,
            salt: salt
        });
        _userIdMap[getAddress(
            credentialId,
            x,
            y,
            salt
        )] = userId;
    }

    /**
     * calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAddress(
        bytes calldata credentialId,
        uint256 x,
        uint256 y,
        uint256 salt
    ) public view returns (address) {
        return
            Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(
                        address(accountImplementation),
                        abi.encodeCall(
                            PasskeyAccount.initialize,
                            (credentialId, x, y)
                        )
                    )
                )
            )
        );
    }

    function getUser(string calldata userId) external view returns (User memory) {
        return _userMap[userId];
    }

    function getUserId(address userAddress) external view returns (string memory) {
        return _userIdMap[userAddress];
    }
}
