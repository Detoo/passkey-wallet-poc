import { Service } from "typedi"
import {
  Address, bytesToBigInt, bytesToHex,
  concat,
  createClient,
  createPublicClient, encodeAbiParameters, encodeFunctionData,
  getContract,
  Hash,
  Hex, hexToBigInt,
  hexToBytes,
  http, parseUnits, PublicClient,
  toHex
} from "viem"
import { ViemService } from "@/lib/service/viem/ViemService"
import { Config } from "@/lib/service/config/Config"
import { baseGoerli } from "viem/chains"
import base64 from "@hexagon/base64"
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyRegistrationResponse
} from "@simplewebauthn/server"
import { startAuthentication, startRegistration } from "@simplewebauthn/browser"
import assert from "assert"
import {
  bundlerActions,
  getAccountNonce,
  getSenderAddress,
  getUserOperationHash,
  GetUserOperationReceiptReturnType,
  UserOperation
} from "permissionless"
import { pimlicoBundlerActions, pimlicoPaymasterActions } from "permissionless/actions/pimlico"
import { AsnParser } from "@peculiar/asn1-schema"
import { ECDSASigValue } from "@peculiar/asn1-ecc"
import * as cborx from "cbor-x"

export interface UserInfo {
  id: string
  credentialId: Hex
  x: bigint
  y: bigint
  salt: bigint
}

export const PASSKEY_ACCOUNT_FACTORY_ADDRESS = "0x63A28A5A169aA1b4650759CfEED8597ce7Ba5910"
export const TEST_TOKEN_ADDRESS = "0xb8c7A8A40BF6A0eF68e8611a337eFc45178BDe8b"
export const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
export const PAYMASTER_AND_DATA: Hex = "0xc059F997624fd240214c025E8bb5572E7c65182e"

@Service()
export class PasskeyAccountService {
  encoder = new cborx.Encoder({
    mapsAsObjects: false,
    tagUint8Array: false
  })

  passkeyAccountFactory
  testToken

  constructor(readonly viem: ViemService, readonly config: Config) {
    this.passkeyAccountFactory = getContract({
      address: PASSKEY_ACCOUNT_FACTORY_ADDRESS,
      abi: [
        {
          "inputs": [
            {
              "internalType": "contract IEntryPoint",
              "name": "_entryPoint",
              "type": "address"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "name": "_userIdMap",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "name": "_userMap",
          "outputs": [
            {
              "internalType": "bytes",
              "name": "credentialId",
              "type": "bytes"
            },
            {
              "internalType": "uint256",
              "name": "x",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "y",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "salt",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "accountImplementation",
          "outputs": [
            {
              "internalType": "contract PasskeyAccount",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "userId",
              "type": "string"
            },
            {
              "internalType": "bytes",
              "name": "credentialId",
              "type": "bytes"
            },
            {
              "internalType": "uint256",
              "name": "x",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "y",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "salt",
              "type": "uint256"
            }
          ],
          "name": "createAccount",
          "outputs": [
            {
              "internalType": "contract PasskeyAccount",
              "name": "ret",
              "type": "address"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "entryPoint",
          "outputs": [
            {
              "internalType": "contract IEntryPoint",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes",
              "name": "credentialId",
              "type": "bytes"
            },
            {
              "internalType": "uint256",
              "name": "x",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "y",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "salt",
              "type": "uint256"
            }
          ],
          "name": "getAddress",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "userId",
              "type": "string"
            }
          ],
          "name": "getUser",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bytes",
                  "name": "credentialId",
                  "type": "bytes"
                },
                {
                  "internalType": "uint256",
                  "name": "x",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "y",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "salt",
                  "type": "uint256"
                }
              ],
              "internalType": "struct PasskeyAccountFactory.User",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "userAddress",
              "type": "address"
            }
          ],
          "name": "getUserId",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ],
      publicClient: viem.publicClient
    })

    this.testToken = getContract({
      address: TEST_TOKEN_ADDRESS,
      abi: [
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "symbol",
              "type": "string"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "owner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "spender",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "value",
              "type": "uint256"
            }
          ],
          "name": "Approval",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "from",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "value",
              "type": "uint256"
            }
          ],
          "name": "Transfer",
          "type": "event"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "owner",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "spender",
              "type": "address"
            }
          ],
          "name": "allowance",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "spender",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "approve",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "account",
              "type": "address"
            }
          ],
          "name": "balanceOf",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "decimals",
          "outputs": [
            {
              "internalType": "uint8",
              "name": "",
              "type": "uint8"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "spender",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "subtractedValue",
              "type": "uint256"
            }
          ],
          "name": "decreaseAllowance",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "drip",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "spender",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "addedValue",
              "type": "uint256"
            }
          ],
          "name": "increaseAllowance",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "name",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "symbol",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "totalSupply",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "transfer",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "from",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "transferFrom",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ],
      publicClient: this.viem.publicClient
    })
  }

  async getAccountInfo(userId: string): Promise<UserInfo> {
    return {
      ...await this.passkeyAccountFactory.read.getUser([userId]),
      id: userId
    }
  }

  async getAccountAddress(userInfo: UserInfo): Promise<Address> {
    return await this.passkeyAccountFactory.read.getAddress([userInfo.credentialId, userInfo.x, userInfo.y, userInfo.salt])
  }

  async createAccount(userId: string): Promise<{ userAddress: Address, txHash: Hash }> {
    const generatedRegistrationOptions = await generateRegistrationOptions({
      rpName: "demo",
      rpID: window.location.hostname,
      userID: userId,
      userName: userId,
      attestationType: "direct",
      challenge: "asdf", // No-op
      supportedAlgorithmIDs: [-7]
    })
    const startRegistrationResponse = await startRegistration(
      generatedRegistrationOptions
    )
    const verificationInput = {
      response: startRegistrationResponse,
      expectedOrigin: window.location.origin,
      expectedChallenge: generatedRegistrationOptions.challenge,
      supportedAlgorithmIDs: [-7]
    }
    console.log({ verificationInput })
    const verificationResponse = await verifyRegistrationResponse(verificationInput)
    console.log({ generatedRegistrationOptions, startRegistrationResponse, verificationResponse })
    assert(verificationResponse.registrationInfo)

    const credentialPublicKey = this.decodeFirst<any>(verificationResponse.registrationInfo.credentialPublicKey)
    const x = credentialPublicKey.get(-2)
    const y = credentialPublicKey.get(-3)
    console.log({ credentialPublicKey, x, y })

    const testTokenDecimals = await this.testToken.read.decimals()

    return await this.send(
      userId,
      startRegistrationResponse.id,
      this.uint8ArrayToHexString(x),
      this.uint8ArrayToHexString(y),
      0n,
      true,
      // After account is created, drip tokens.
      encodeFunctionData({
        abi: [{
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "drip",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }],
        args: [parseUnits("100", testTokenDecimals)]
      })
    )
  }

  async transfer(userInfo: UserInfo, destAddress: Address, amount: Big): Promise<{
    from: Address,
    to: Address,
    txHash: Hash
  }> {
    const testTokenDecimals = await this.testToken.read.decimals()
    const { userAddress, txHash } = await this.send(
      userInfo.id,
      base64.fromArrayBuffer(hexToBytes(userInfo.credentialId).buffer, true),
      toHex(userInfo.x),
      toHex(userInfo.y),
      0n,
      false,
      // Account already created, transfer tokens.
      encodeFunctionData({
        abi: [{
          "inputs": [
            {
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function",
          "name": "transfer",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ]
        }],
        args: [destAddress, parseUnits(amount.toFixed(), testTokenDecimals)]
      })
    )
    return { from: userAddress, to: destAddress, txHash }
  }

  async send(userId: string, credentialIdBase64: string, xHex: Hex, yHex: Hex, salt: bigint, init: boolean, internalCalldata: Hex): Promise<{
    userAddress: Address,
    txHash: Hash
  }> {
    const credentialId = this.uint8ArrayToHexString(new Uint8Array(base64.toArrayBuffer(credentialIdBase64, true)))

    console.log({
      credentialIdBase64,
      credentialId,
      xHex,
      yHex,
      salt
    })

    // CREATE THE CLIENTS
    const pimlicoChain = "base-goerli"

    const bundlerClient = createClient({
      transport: http(`https://api.pimlico.io/v1/${pimlicoChain}/rpc?apikey=${this.config.pimlicoApiKey}`),
      chain: baseGoerli
    }).extend(bundlerActions).extend(pimlicoBundlerActions)

    const paymasterClient = createClient({
      transport: http(`https://api.pimlico.io/v2/${pimlicoChain}/rpc?apikey=${this.config.pimlicoApiKey}`),
      chain: baseGoerli
    }).extend(pimlicoPaymasterActions)

    // GENERATE THE INITCODE
    const initCode = concat([
      PASSKEY_ACCOUNT_FACTORY_ADDRESS,
      encodeFunctionData({
        abi: [{
          inputs: [{ name: "userId", type: "string" }, { name: "credentialId", type: "bytes" }, {
            name: "x",
            type: "uint256"
          }, {
            name: "y",
            type: "uint256"
          }, { name: "salt", type: "uint256" }],
          name: "createAccount",
          outputs: [{ name: "ret", type: "address" }],
          stateMutability: "nonpayable",
          type: "function"
        }],
        args: [
          userId,
          credentialId,
          hexToBigInt(xHex),
          hexToBigInt(yHex),
          salt
        ]
      })
    ])

    console.log("Generated initCode:", initCode)

    // CALCULATE THE SENDER ADDRESS
    const senderAddress = await getSenderAddress(this.viem.publicClient, {
      initCode,
      entryPoint: ENTRY_POINT_ADDRESS
    })
    console.log("Calculated sender address:", senderAddress)

    const callData = encodeFunctionData({
      abi: [{
        inputs: [
          { name: "dest", type: "address" },
          { name: "value", type: "uint256" },
          { name: "func", type: "bytes" }
        ],
        name: "execute",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      }],
      args: [this.testToken.address, 0n, internalCalldata]
    })

    console.log("Generated callData:", callData)

    // FILL OUT REMAINING USER OPERATION VALUES
    const nonce = await getAccountNonce(this.viem.publicClient, {
      entryPoint: ENTRY_POINT_ADDRESS,
      sender: senderAddress
    })
    const gasPrice = await bundlerClient.getUserOperationGasPrice()
    console.log({ nonce, gasPrice })

    const userOperation: UserOperation = {
      sender: senderAddress,
      nonce,
      initCode: init ? initCode : "0x",
      callData,
      maxFeePerGas: gasPrice.fast.maxFeePerGas,
      maxPriorityFeePerGas: gasPrice.fast.maxPriorityFeePerGas,

      //
      // For paymaster sponsorship
      //

      // Dummy signature from a past valid PasskeyAccount creation (https://goerli.basescan.org/tx/0x73cd0c4bdefee0520692be355af2dea5c0edabb64e2eeff5d0fce5230546e9d1)
      signature: "0xfcedd46b5cf4547119f1d1e2ea046d800fca63b61d82d2ddb890551d4f4d607fcb4dd0df143adb5bdfdaf3f1ac42ba0dc6370d39b7edf481a8177282877ba50500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000002591915c3cda3f6f67bc331a2ad1e7faf6a98afbc2fefb21a6b0c3a85d7478bb9f1d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000247b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a22000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000033222c226f726967696e223a2268747470733a2f2f706173736b65792d77616c6c65742d706f632e6465746f6f2e696e666f227d00000000000000000000000000",

      // No-op. Just to keep the linter happy.
      callGasLimit: 0n,
      verificationGasLimit: 0n,
      preVerificationGas: 0n,
      paymasterAndData: "0x"
    }
    console.log({ userOperation })

    // REQUEST PIMLICO VERIFYING PAYMASTER SPONSORSHIP
    const sponsorUserOperationResult = await paymasterClient.sponsorUserOperation({
      userOperation,
      entryPoint: ENTRY_POINT_ADDRESS
    })

    const sponsoredUserOperation: UserOperation = {
      ...userOperation,
      preVerificationGas: sponsorUserOperationResult.preVerificationGas,
      verificationGasLimit: sponsorUserOperationResult.verificationGasLimit,
      callGasLimit: sponsorUserOperationResult.callGasLimit,
      paymasterAndData: sponsorUserOperationResult.paymasterAndData
      // Note at this moment the signature is still a dummy.
    }

    console.log({ sponsoredUserOperation, sponsorUserOperationResult })

    //
    // Start signing
    //

    const userOperationHash = getUserOperationHash(
      {
        userOperation: sponsoredUserOperation,
        chainId: baseGoerli.id,
        entryPoint: ENTRY_POINT_ADDRESS
      })
    console.log({ userOperationHash })

    const challenge = hexToBytes(userOperationHash)
    const challengeBase64 = base64.fromArrayBuffer(challenge.buffer, true)
    const authenticationOptions = await generateAuthenticationOptions({
      rpID: window.location.hostname,
      challenge
    })

    const authenticationResponse = await startAuthentication(
      authenticationOptions
    )
    console.log({ authenticationOptions, authenticationResponse })

    const clientDataJSON = base64.toArrayBuffer(
      authenticationResponse.response.clientDataJSON,
      true
    )

    const clientDataJSONStr = base64.toString(
      authenticationResponse.response.clientDataJSON,
      true
    )
    const clientDataJSONObj = JSON.parse(clientDataJSONStr)
    console.log({ clientDataJSON, clientDataJSONStr, clientDataJSONObj })

    // Split the clientData JSON string (we can't do it in base64-encoded form because base64 is 3-byte-aligned)
    const [clientDataJSONStrPrefix, clientDataJSONStrPostfix] = clientDataJSONStr.split(challengeBase64)
    console.log({
      clientDataJSONStrPrefix, clientDataJSONStrPostfix, challengeBase64, clientDataJSONStr,
      clientDataJSONHex: this.uint8ArrayToHexString(new Uint8Array(clientDataJSON))
    })

    const authenticatorData = base64.toArrayBuffer(
      authenticationResponse.response.authenticatorData,
      true
    )
    console.log({
      authenticatorData,
      authenticatorDataHex: this.uint8ArrayToHexString(new Uint8Array(authenticatorData))
    })

    const authSignature = base64.toArrayBuffer(
      authenticationResponse.response.signature,
      true
    )

    const parsedAuthSignature = AsnParser.parse(authSignature, ECDSASigValue)
    let rBytes = new Uint8Array(parsedAuthSignature.r)
    let sBytes = new Uint8Array(parsedAuthSignature.s)

    if (this.shouldRemoveLeadingZero(rBytes)) {
      rBytes = rBytes.slice(1)
    }

    if (this.shouldRemoveLeadingZero(sBytes)) {
      sBytes = sBytes.slice(1)
    }

    const signedUserOperation = {
      ...sponsoredUserOperation,
      signature: encodeAbiParameters(
        [
          { name: "r", type: "uint256" },
          { name: "s", type: "uint256" },
          { name: "authenticatorData", type: "bytes" },
          { name: "clientDataJSONStrPrefix", type: "string" },
          { name: "clientDataJSONStrPostfix", type: "string" }
        ],
        [
          bytesToBigInt(rBytes),
          bytesToBigInt(sBytes),
          bytesToHex(new Uint8Array(authenticatorData)),
          clientDataJSONStrPrefix,
          clientDataJSONStrPostfix
        ]
      )
    }

    console.log("sig data:", {
      r: this.uint8ArrayToHexString(rBytes),
      s: this.uint8ArrayToHexString(sBytes),
      x: xHex,
      y: yHex,
      signedUserOperation
    })

    // SUBMIT THE USER OPERATION TO BE BUNDLED
    const signedUserOperationHash = await bundlerClient.sendUserOperation({
      userOperation: signedUserOperation,
      entryPoint: ENTRY_POINT_ADDRESS
    })

    console.log("Received User Operation hash:", signedUserOperationHash)

    // let's also wait for the userOperation to be included, by continually querying for the receipts
    console.log("Querying for receipts...")
    let receipt: GetUserOperationReceiptReturnType | null = null
    while (receipt === null) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      receipt = await bundlerClient.getUserOperationReceipt({ hash: signedUserOperationHash })
      console.log(receipt === null ? "Still waiting..." : `Receipt received: ${receipt.success ? "success" : "failure"}`)
    }

    const txHash = receipt.receipt.transactionHash

    console.log(`UserOperation included: https://goerli.basescan.org/tx/${txHash}`)

    return {
      userAddress: senderAddress,
      txHash
    }
  }

  uint8ArrayToHexString(uint8Array: Uint8Array): Hex {
    return `0x${Array.from(uint8Array, (byte: any) => {
      return ("0" + (byte & 0xFF).toString(16)).slice(-2)
    }).join("")}`
  }

  decodeFirst<Type>(input: Uint8Array): Type {
    const decoded = this.encoder.decodeMultiple(input) as undefined | Type[]

    if (decoded === undefined) {
      throw new Error("CBOR input data was empty")
    }

    /**
     * Typing on `decoded` is `void | []` which causes TypeScript to think that it's an empty array,
     * and thus you can't destructure it. I'm ignoring that because the code works fine in JS, and
     * so this should be a valid operation.
     */
      // @ts-ignore 2493
    const [first] = decoded

    return first
  }

  shouldRemoveLeadingZero(bytes: Uint8Array): boolean {
    return bytes[0] === 0x0 && (bytes[1] & (1 << 7)) !== 0
  }
}
