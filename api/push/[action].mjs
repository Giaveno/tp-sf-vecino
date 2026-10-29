import { createHmac } from 'node:crypto'
import { ipAddress, waitUntil } from '@vercel/functions'
import { createVercelPushHandler } from '../../server/vercel-handler.mjs'

const handler = createVercelPushHandler({
  waitUntil,
  rateKey: (request) => createHmac('sha256', process.env.VAPID_PRIVATE_KEY).update(ipAddress(request) ?? 'anonymous').digest('hex'),
})

export default { fetch: handler }
