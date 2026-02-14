import { describe, it, expect, vi, beforeEach } from "vitest"
import { convexTest } from "convex-test"
import schema from "./schema"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

vi.mock("./r2", () => ({
  r2: {
    getUrl: vi.fn(async () => "https://example.com/content"),
    store: vi.fn(async () => "r2Key"),
    deleteObject: vi.fn(async () => undefined),
  },
}))

const modules = import.meta.glob("./**/*.ts")

function makeT() {
  return convexTest(schema, modules)
}

async function seedFreeUser(t: ReturnType<typeof makeT>, authId: string) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: `${authId}@example.com`,
      createdAt: Date.now(),
      authId,
      dedicatedEmail: `${authId}@inbound.example.com`,
      plan: "free",
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

async function seedSenderAndFolder(t: ReturnType<typeof makeT>, userId: Id<"users">) {
  return await t.run(async (ctx) => {
    const senderId = await ctx.db.insert("senders", {
      email: "sender@example.com",
      domain: "example.com",
      name: "Sender",
      subscriberCount: 1,
      newsletterCount: 0,
    })
    const folderId = await ctx.db.insert("folders", {
      userId,
      name: "Inbox",
      isHidden: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    return { senderId, folderId }
  })
}

describe("Free plan storage caps integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("stores unlocked while under 1,000 unlocked cap", async () => {
    const t = makeT()
    const authId = "auth_free_caps_1"
    const userId = await seedFreeUser(t, authId)
    const { senderId, folderId } = await seedSenderAndFolder(t, userId)

    await t.mutation(internal.entitlements.upsertUserUsageCounters, {
      userId,
      totalStored: 999,
      unlockedStored: 999,
      lockedStored: 0,
    })

    const result = await t.action(internal.newsletters.storeNewsletterContent, {
      userId,
      senderId,
      folderId,
      subject: "Newsletter 1000",
      senderEmail: "sender@example.com",
      senderName: "Sender",
      receivedAt: Date.now(),
      textContent: "",
      source: "email",
    })

    if ("skipped" in result && result.skipped) throw new Error("Expected store to succeed")

    const stored = await t.run(async (ctx) => await ctx.db.get(result.userNewsletterId))
    expect(stored?.isLockedByPlan).toBe(false)
  })

  it("locks new arrivals after 1,000 unlocked cap", async () => {
    const t = makeT()
    const authId = "auth_free_caps_2"
    const userId = await seedFreeUser(t, authId)
    const { senderId, folderId } = await seedSenderAndFolder(t, userId)

    await t.mutation(internal.entitlements.upsertUserUsageCounters, {
      userId,
      totalStored: 1000,
      unlockedStored: 1000,
      lockedStored: 0,
    })

    const result = await t.action(internal.newsletters.storeNewsletterContent, {
      userId,
      senderId,
      folderId,
      subject: "Newsletter 1001",
      senderEmail: "sender@example.com",
      senderName: "Sender",
      receivedAt: Date.now(),
      textContent: "",
      source: "email",
    })

    if ("skipped" in result && result.skipped) throw new Error("Expected store to succeed")

    const stored = await t.run(async (ctx) => await ctx.db.get(result.userNewsletterId))
    expect(stored?.isLockedByPlan).toBe(true)
  })

  it("skips storing when at hard cap (plan_limit)", async () => {
    const t = makeT()
    const authId = "auth_free_caps_3"
    const userId = await seedFreeUser(t, authId)
    const { senderId, folderId } = await seedSenderAndFolder(t, userId)

    await t.mutation(internal.entitlements.upsertUserUsageCounters, {
      userId,
      totalStored: 2000,
      unlockedStored: 1000,
      lockedStored: 1000,
    })

    const result = await t.action(internal.newsletters.storeNewsletterContent, {
      userId,
      senderId,
      folderId,
      subject: "Newsletter 2001",
      senderEmail: "sender@example.com",
      senderName: "Sender",
      receivedAt: Date.now(),
      textContent: "",
      source: "email",
    })

    expect(result).toMatchObject({ skipped: true, reason: "plan_limit" })
  })
})

