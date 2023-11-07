# Passkey Wallet Proof-of-Concept

The project demonstrates the ability to hold an account, sign & publish arbitrary Ethereum VM transactions 
using your Passkey device (ex. mobile phone's fingerprint reader, Face ID, etc.) without holding any crypto as prerequisites. 

More specifically, in this demo the user would be able to register and create an account, 
receive 100 test tokens, and send it to other accounts (or to any arbitrary address). 
The user would be able to do it in a gas-less fashion because the transaction fee is 
sponsored by a third-party. The user wouldn't have to buy crypto on an exchange 
nor using a credit card just to be able to pay for the transaction fee. 
On-ramp is much simpler this way and all the user needs is a mobile phone with Passkey-support to get started.

## Architectures

- [ERC-4337](https://www.erc4337.io/) (Account Abstraction) for Smart Contract wallets
- [P256 Verifier](https://daimo.xyz/blog/p256verifier) for verifying Passkey's secp256r1 signatures
- [Pimlico](https://www.pimlico.io/) for off-chain infra (bundler and paymaster)

## File Structures

- [`contracts/`](contracts/): Solidity contracts for Passkey Account, Factory and test token
- [`frontend/`](frontend/): Web UI for interacting with the wallet 

## References

- Inspired by [ZK Face ID](https://hackmd.io/@knownothing/zk-face-id) and their awesome [demo](https://www.noseedphrases.xyz/) 🔥