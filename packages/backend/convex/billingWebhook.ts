import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"

function base64ToBytes(input: string): Uint8Array {
  const binary = atob(input)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function parseSignatureHeader(header: string): string[] {
  // Standard Webhooks format: space-delimited list of signatures.
  // Common forms: "v1,<base64>" or "v1=<base64>".
  return header
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("v1,")) return part.slice(3)
      if (part.startsWith("v1=")) return part.slice(3)
      return part
    })
    .filter(Boolean)
}

async function computeHmacBase64(secretBase64: string, message: string): Promise<string> {
  const secret = base64ToBytes(secretBase64)
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))
  const bytes = new Uint8Array(sig)
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

async function verifyStandardWebhookRequest(args: {
  payload: string
  webhookId: string
  webhookTimestamp: string
  webhookSignature: string
}): Promise<boolean> {
  const secret = process.env.POLAR_WEBHOOK_SECRET
  if (!secret) return false

  const timestampSeconds = Number(args.webhookTimestamp)
  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) return false

  // 5 minute tolerance
  const toleranceMs = 5 * 60 * 1000
  const deltaMs = Math.abs(Date.now() - timestampSeconds * 1000)
  if (deltaMs > toleranceMs) return false

  const message = `${args.webhookId}.${args.webhookTimestamp}.${args.payload}`
  const expected = await computeHmacBase64(secret, message)
  const candidates = parseSignatureHeader(args.webhookSignature)
  return candidates.some((candidate) => constantTimeEqual(candidate, expected))
}

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const ms = Date.parse(value)
    if (Number.isFinite(ms)) return ms
  }
  return undefined
}

export const handlePolarWebhook = httpAction(async (ctx, request) => {
  const webhookId = request.headers.get("webhook-id")
  const webhookTimestamp = request.headers.get("webhook-timestamp")
  const webhookSignature = request.headers.get("webhook-signature")

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return new Response(JSON.stringify({ error: "Missing webhook headers" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const payload = await request.text()
  const ok = await verifyStandardWebhookRequest({
    payload,
    webhookId,
    webhookTimestamp,
    webhookSignature,
  })

  if (!ok) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  const isNew = await ctx.runMutation(internal.billing.recordWebhookEventIfNew, {
    eventId: webhookId,
  })
  if (!isNew) {
    return new Response(JSON.stringify({ ok: true, deduped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  let event: any
  try {
    event = JSON.parse(payload)
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const eventType = String(event?.type ?? "")

  if (eventType.startsWith("subscription.")) {
    const subscription = event?.data ?? {}
    const customer = subscription?.customer ?? {}
    const externalCustomerId = String(customer?.external_id ?? "")
    if (!externalCustomerId) {
      return new Response(JSON.stringify({ ok: true, ignored: "missing_external_customer_id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const polarCustomerId =
      typeof subscription?.customer_id === "string"
        ? subscription.customer_id
        : typeof customer?.id === "string"
          ? customer.id
          : undefined

    const polarSubscriptionId =
      typeof subscription?.id === "string" ? subscription.id : undefined

    const status = typeof subscription?.status === "string" ? subscription.status : undefined
    const currentPeriodEndMs = toMillis(subscription?.current_period_end)

    const result = await ctx.runMutation(internal.billing.applySubscriptionUpdate, {
      externalCustomerId,
      polarCustomerId,
      polarSubscriptionId,
      status,
      currentPeriodEndMs,
      eventType,
    })

    if (result.userId && result.becamePro) {
      await ctx.runMutation(internal.entitlements.unlockAllLockedNewslettersForUser, {
        userId: result.userId,
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Accept and ignore other events for now.
  return new Response(JSON.stringify({ ok: true, ignored: eventType || "unknown" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})

