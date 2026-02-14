import { describe, it, expect, vi, beforeEach } from "vitest"
import { convexTest } from "convex-test"
import schema from "./schema"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { generateCompletion } from "./lib/openrouter"

vi.mock("./lib/openrouter", () => ({
  generateCompletion: vi.fn(async () => "Summary"),
}))

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

async function seedUser(t: ReturnType<typeof makeT>, args: { authId: string; plan: "free" | "pro" }) {
  const proExpiresAt =
    args.plan === "pro" ? Date.now() + 7 * 24 * 60 * 60 * 1000 : undefined

  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: `${args.authId}@example.com`,
      createdAt: Date.now(),
      authId: args.authId,
      dedicatedEmail: `${args.authId}@inbound.example.com`,
      plan: args.plan,
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

async function seedNewsletter(t: ReturnType<typeof makeT>, args: {
  userId: Id<"users">
  senderId: Id<"senders">
  folderId: Id<"folders">
  subject: string
}) {
  return await t.mutation(internal.newsletters.createUserNewsletter, {
    userId: args.userId,
    senderId: args.senderId,
    folderId: args.folderId,
    subject: args.subject,
    senderEmail: "sender@example.com",
    senderName: "Sender",
    receivedAt: Date.now(),
    isPrivate: true,
    isLockedByPlan: false,
    privateR2Key: `private/${args.userId}/${crypto.randomUUID()}.html`,
    contentId: undefined,
    source: "email",
  })
}

describe("AI summaries (Pro-only) integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENROUTER_API_KEY = "test"

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "<p>Hello</p>",
      })),
    )
  })

  it("blocks Free users (PRO_REQUIRED)", async () => {
    const t = makeT()
    const authId = "auth_free"
    const userId = await seedUser(t, { authId, plan: "free" })
    const { senderId, folderId } = await seedSenderAndFolder(t, userId)
    const newsletterId = await seedNewsletter(t, {
      userId,
      senderId,
      folderId,
      subject: "Newsletter 1",
    })

    await expect(
      t.withIdentity({ subject: authId }).action(api.ai.generateSummary, {
        userNewsletterId: newsletterId,
      }),
    ).rejects.toMatchObject({
      data: expect.stringContaining("\"code\":\"PRO_REQUIRED\""),
    })
  })

  it("enforces 50/day AI limit (51st fails)", async () => {
    const t = makeT()
    const authId = "auth_pro_limit"
    const userId = await seedUser(t, { authId, plan: "pro" })
    const { senderId, folderId } = await seedSenderAndFolder(t, userId)

    const newsletterIds: Id<"userNewsletters">[] = []
    for (let i = 0; i < 51; i++) {
      // eslint-disable-next-line no-await-in-loop
      newsletterIds.push(
        await seedNewsletter(t, {
          userId,
          senderId,
          folderId,
          subject: `Newsletter ${i + 1}`,
        }),
      )
    }

    for (let i = 0; i < 50; i++) {
      // eslint-disable-next-line no-await-in-loop
      await t.withIdentity({ subject: authId }).action(api.ai.generateSummary, {
        userNewsletterId: newsletterIds[i],
      })
    }

    await expect(
      t.withIdentity({ subject: authId }).action(api.ai.generateSummary, {
        userNewsletterId: newsletterIds[50],
      }),
    ).rejects.toMatchObject({
      data: expect.stringContaining("\"code\":\"AI_LIMIT_REACHED\""),
    })
  })

  it("enforces 60s regenerate cooldown (AI_COOLDOWN)", async () => {
    const t = makeT()
    const authId = "auth_pro_cooldown"
    const userId = await seedUser(t, { authId, plan: "pro" })
    const { senderId, folderId } = await seedSenderAndFolder(t, userId)
    const newsletterId = await seedNewsletter(t, {
      userId,
      senderId,
      folderId,
      subject: "Cooldown newsletter",
    })

    await t.withIdentity({ subject: authId }).action(api.ai.generateSummary, {
      userNewsletterId: newsletterId,
    })

    await expect(
      t.withIdentity({ subject: authId }).action(api.ai.generateSummary, {
        userNewsletterId: newsletterId,
        forceRegenerate: true,
      }),
    ).rejects.toMatchObject({
      data: expect.stringContaining("\"code\":\"AI_COOLDOWN\""),
    })
  })

  it("enforces 1-at-a-time concurrency (AI_BUSY)", async () => {
    const t = makeT()
    const authId = "auth_pro_busy"
    const userId = await seedUser(t, { authId, plan: "pro" })
    const { senderId, folderId } = await seedSenderAndFolder(t, userId)
    const newsletterId = await seedNewsletter(t, {
      userId,
      senderId,
      folderId,
      subject: "Busy newsletter",
    })

    const completion = vi.mocked(generateCompletion)
    let started = false
    let resolveCompletion: ((value: string) => void) | null = null
    completion.mockImplementation(
      async () =>
        await new Promise<string>((resolve) => {
          started = true
          resolveCompletion = resolve
        }),
    )

    const p1 = t.withIdentity({ subject: authId }).action(api.ai.generateSummary, {
      userNewsletterId: newsletterId,
    })

    // Wait until the first request reaches the mocked completion call (lock acquired).
    while (!started) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve()
    }

    await expect(
      t.withIdentity({ subject: authId }).action(api.ai.generateSummary, {
        userNewsletterId: newsletterId,
      }),
    ).rejects.toMatchObject({
      data: expect.stringContaining("\"code\":\"AI_BUSY\""),
    })

    resolveCompletion?.("Summary")
    await expect(p1).resolves.toMatchObject({ summary: "Summary" })
  })
})
