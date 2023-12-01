import type { NextApiRequest, NextApiResponse } from "next"
import { kv } from "@vercel/kv"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    try {
      const addressKey = (req.query.address! as string).toLowerCase()
      res.status(200).json({ hasNotification: !!(await kv.sismember(addressKey, req.query.endpoint)) })
    } catch (e: any) {
      const payload = { event: "NotificationGetFailed", reason: e.toString() }
      console.error(payload)
      res.status(500).json(payload)
    }

  } else if (req.method === "POST") {
    // Subscribe or unsubscribe
    try {
      const data = req.body

      if (data.action === "subscribe") {
        console.log("subscribe:", data)
        const addressKey = data.payload.address.toLowerCase()
        const sub = data.payload.sub
        await kv.sadd(addressKey, sub.endpoint)
        await kv.set(sub.endpoint, JSON.stringify(sub))

      } else if (data.action === "unsubscribe") {
        console.log("unsubscribe:", data)
        const addressKey = data.payload.address.toLowerCase()
        const sub = data.payload.sub
        if (await kv.srem(addressKey, sub.endpoint)) {
          await kv.del(sub.endpoint)
        }

      } else {
        const msg = `unexpected action:${data.action}`
        console.error(msg)
        res.status(500).json(msg)
        return
      }

      console.log("done")

      // Send a response
      res.status(200).json({ success: true })
    } catch (e: any) {
      const payload = { event: "NotificationPostFailed", reason: e.toString(), reqBody: req.body }
      console.error(payload)
      res.status(500).json(payload)
    }
  } else {
    // Return a 405 Method Not Allowed if the request method is not POST
    res.status(405).end()
  }
}
