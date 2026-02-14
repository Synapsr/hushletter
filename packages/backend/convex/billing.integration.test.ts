import { describe, it, expect, beforeEach } from "vitest"
import { convexTest } from "convex-test"
import schema from "./schema"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

const modules = import.meta.glob("./**/*.ts")

function makeT() {
  return convexTest(schema, modules)
}

async function seedUser(t: ReturnType<typeof makeT>, authId: string, plan: "free" | "pro", proExpiresAt?: number) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: `${authId}@example.com`,
      createdAt: Date.now(),
      authId,
      dedicatedEmail: `${authId}@inbound.example.com`,
      plan,
      proExpiresAt,
    })
    await ctx.db.insert("userUsageCounters", {
      userId,
      totalStored: 0,
      unlockedStored: 0,
      lockedStored: 0,
      updatedAt: Date.now(),
    })
    return userId
  })
}

async function getUser(t: ReturnType<typeof makeT>, userId: Id<"users">) {
  return await t.run(async (ctx) => await ctx.db.get(userId))
}

describe("Billing webhook integration", () => {
  beforeEach(() => {
    // New backend per test via makeT().
  })

  it("dedupes webhook events by eventId", async () => {
    const t = makeT()
    const first = await t.mutation(internal.billing.recordWebhookEventIfNew, {
      eventId: "evt_123",
    })
    const second = await t.mutation(internal.billing.recordWebhookEventIfNew, {
      eventId: "evt_123",
    })
    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  it("keeps Pro until current_period_end when subscription is canceled", async () => {
    const t = makeT()
    const authId = "auth_canceled"
    const userId = await seedUser(t, authId, "free")
    const periodEnd = Date.now() + 3 * 24 * 60 * 60 * 1000

    await t.mutation(internal.billing.applySubscriptionUpdate, {
      externalCustomerId: authId,
      polarCustomerId: "cus_1",
      polarSubscriptionId: "sub_1",
      status: "canceled",
      currentPeriodEndMs: periodEnd,
      eventType: "subscription.updated",
    })

    const user = await getUser(t, userId)
    expect(user?.plan).toBe("pro")
    expect(user?.proExpiresAt).toBe(periodEnd)
  })

  it("reverts to Free once current_period_end is in the past", async () => {
    const t = makeT()
    const authId = "auth_expired"
    const userId = await seedUser(t, authId, "pro", Date.now() + 60_000)
    const periodEnd = Date.now() - 1

    await t.mutation(internal.billing.applySubscriptionUpdate, {
      externalCustomerId: authId,
      polarCustomerId: "cus_2",
      polarSubscriptionId: "sub_2",
      status: "canceled",
      currentPeriodEndMs: periodEnd,
      eventType: "subscription.revoked",
    })

    const user = await getUser(t, userId)
    expect(user?.plan).toBe("free")
    expect(user?.proExpiresAt).toBeUndefined()
  })
})

