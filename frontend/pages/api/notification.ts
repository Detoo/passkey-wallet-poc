import type { NextApiRequest, NextApiResponse } from "next"
import { kv } from "@vercel/kv"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    // Read
    try {
      const sub = await kv.get("sub")
      res.status(200).json(sub)
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

        // TODO deprecated: brute force data structure
        // const subs: any[] = await kv.get(key) || []
        // const idx = subs.findIndex(item => item.endpoint === sub.endpoint)
        // if (idx > -1) {
        //   subs[idx] = sub
        // } else {
        //   subs.push(sub)
        // }
        // await kv.set(
        //   data.payload.address.toLowerCase(),
        //   JSON.stringify(subs)
        // )
      } else if (data.action === "unsubscribe") {
        console.log("unsubscribe:", data)
        const addressKey = data.payload.address.toLowerCase()
        const sub = data.payload.sub
        if (await kv.srem(addressKey, sub.endpoint)) {
          await kv.del(sub.endpoint)
        }

        // TODO deprecated: brute force data structure
        // const subs: any[] = await kv.get(key) || []
        // const idx = subs.findIndex(item => item.endpoint === sub.endpoint)
        // if (idx > -1) {
        //   subs.splice(idx, 1)
        // }
        // await kv.set(
        //   data.payload.address.toLowerCase(),
        //   JSON.stringify(subs)
        // )
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
