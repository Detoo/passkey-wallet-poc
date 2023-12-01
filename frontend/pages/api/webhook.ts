import webPush from "web-push"
import { hexToBigInt, formatEther, getAddress } from "viem"
import { kv } from "@vercel/kv"
import { NextApiRequest, NextApiResponse } from "next"

webPush.setVapidDetails(
  `mailto:${process.env.WEB_PUSH_EMAIL}`,
  process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!,
  process.env.WEB_PUSH_PRIVATE_KEY!
)

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

        const walletName = getAddress(to)

        // Get subscription from persistent store
        const addressKey = to.toLowerCase()
        const endpoints = await kv.smembers(addressKey)
        for (const endpoint of endpoints) {
          const subscription = await kv.get(endpoint)
          if (subscription) {
            await webPush.sendNotification(
              subscription as any,
              JSON.stringify({ title: "PasskeyWallet", message: `${walletName} received ${amount} tokens` })
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
