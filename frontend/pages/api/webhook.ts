import webPush from "web-push"
import { hexToBigInt, formatEther, getAddress, getContract } from "viem"
import { kv } from "@vercel/kv"
import { NextApiRequest, NextApiResponse } from "next"
import { Container } from "typedi"
import {
  PASSKEY_ACCOUNT_FACTORY_ADDRESS
} from "@/lib/service/passkey-account/PasskeyAccountService"
import { ViemService } from "@/lib/service/viem/ViemService"

webPush.setVapidDetails(
  `mailto:${process.env.WEB_PUSH_EMAIL}`,
  process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!,
  process.env.WEB_PUSH_PRIVATE_KEY!
)

const viemService = Container.get(ViemService)
const passkeyAccountFactory = getContract({
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
  publicClient: viemService.publicClient
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      const logs = req.body.event.data.block.logs

      let count = 0
      for (const log of logs) {
        const from = "0x" + log.topics[1].slice(-40)
        const to = "0x" + log.topics[2].slice(-40)
        const amount = +formatEther(hexToBigInt(log.data))
        console.log({ event: "TransferEvent", from, to, amount })

        // Get the User ID
        const userId = await passkeyAccountFactory.read.getUserId([getAddress(to)]) || "(unknown)"

        // Get subscription from persistent store
        const addressKey = to.toLowerCase()
        const endpoints = await kv.smembers(addressKey)
        for (const endpoint of endpoints) {
          const subscription = await kv.get(endpoint)
          if (subscription) {
            await webPush.sendNotification(
              subscription as any,
              JSON.stringify({ title: "PasskeyWallet", message: `${userId} received ${amount} tokens` })
            )
            console.log({ event: "NotificationSent", subscription })
            count += 1
          } else {
            console.warn({ event: "AbortNoSubscription" })
          }
        }
      }

      // Send a response
      res.status(200).json({ success: true, count })
    } catch (e: any) {
      const payload = { event: "NotifyTransferEventFailed", reason: e.toString(), reqBody: req.body }
      console.error(payload)
      res.status(500).json(payload)
    }
  } else {
    // Return a 405 Method Not Allowed if the request method is not POST
    res.status(405).end()
  }
}
