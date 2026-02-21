/**
 * AI-related functions for newsletter summarization
 * Story 5.1: AI Summary Generation
 *
 * Architecture Notes:
 * - Provider: OpenRouter + Kimi K2 (moonshotai/kimi-k2)
 * - Server-side only: API keys never exposed to client
 * - User-triggered: No automatic summarization
 * - Cost optimization: Public newsletters share summaries, private stay per-user
 *
 * Summary Storage Logic:
 * - First generation (public): Store on newsletterContent.summary (shared with all)
 * - Regeneration (any): Store on userNewsletters.summary (personal override)
 * - Private newsletter: Store on userNewsletters.summary (per-user)
 *
 * Summary Resolution Priority:
 * 1. userNewsletters.summary (personal)
 * 2. newsletterContent.summary (shared, public only)
 * 3. null (no summary)
 */

import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server"
import { v, ConvexError } from "convex/values"
import { internal } from "./_generated/api"
import { generateCompletion } from "./lib/openrouter"
import type { Id } from "./_generated/dataModel"
import { AI_DAILY_LIMIT, isUserPro } from "./entitlements"

/** System prompt for consistent, useful summaries */
const SUMMARY_SYSTEM_PROMPT = `You are a helpful assistant that summarizes newsletter content.

IMPORTANT: Write the summary in the SAME LANGUAGE as the newsletter content. If the newsletter is in French, write the summary in French. If in Spanish, write in Spanish. Match the content's language exactly.

Create a concise summary that captures:
- Key points and main topics (3-5 bullet points)
- Important takeaways
- Any action items or deadlines mentioned

Keep the summary under 200 words. Use clear, simple language.
Format as a brief introduction followed by bullet points.`

/**
 * Generate AI summary for a newsletter
 * Story 5.1: Task 3 - Main action for summary generation
 *
 * Implements cost optimization:
 * - Returns existing summary if available (no API call)
 * - First public generation shared with all users
 * - Regeneration creates personal override
 *
 * @throws ConvexError with codes: NOT_FOUND, CONTENT_UNAVAILABLE, CONTENT_FETCH_ERROR,
 *         AI_CONFIG_ERROR, AI_TIMEOUT, AI_UNAVAILABLE
 */
export const generateSummary = action({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    forceRegenerate: v.optional(v.boolean()), // true = user clicked "Regenerate"
  },
  handler: async (
    ctx,
    { userNewsletterId, forceRegenerate }
  ): Promise<{ summary: string; isShared: boolean }> => {
    // Authenticate user
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      })
    }

    // Get user record
    const user = await ctx.runQuery(internal._internal.users.findByAuthId, {
      authId: identity.subject,
    })
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found",
      })
    }

    if (!isUserPro({ plan: user.plan ?? "free", proExpiresAt: user.proExpiresAt })) {
      throw new ConvexError({
        code: "PRO_REQUIRED",
        message: "Hushletter Pro is required for AI summaries.",
      })
    }

    // Get newsletter metadata to check if public/private and ownership
    const newsletter = await ctx.runQuery(internal.ai.getNewsletterForSummary, {
      userNewsletterId,
    })

    if (!newsletter) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter not found",
      })
    }

    // Privacy check - user can only generate summaries for their own newsletters
    if (newsletter.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Access denied",
      })
    }

    // COST OPTIMIZATION: Check for existing summary (unless regenerating)
    if (!forceRegenerate) {
      // Priority 1: Check personal summary (userNewsletters)
      if (newsletter.summary) {
        return { summary: newsletter.summary, isShared: false }
      }

      // Priority 2: Check shared summary (public newsletters only)
      if (!newsletter.isPrivate && newsletter.contentId) {
        const sharedSummary = await ctx.runQuery(internal.ai.getSharedSummary, {
          contentId: newsletter.contentId,
        })

        if (sharedSummary) {
          // Return existing shared summary - NO API CALL NEEDED!
          return { summary: sharedSummary, isShared: true }
        }
      }
    }

    // Call the AI (no cached summary, or regenerating).
    if (
      forceRegenerate &&
      typeof newsletter.lastSummaryRequestAt === "number" &&
      Date.now() - newsletter.lastSummaryRequestAt < 60_000
    ) {
      throw new ConvexError({
        code: "AI_COOLDOWN",
        message: "Please wait a moment before regenerating this summary.",
      })
    }

    const acquired = await ctx.runMutation(internal.ai.tryAcquireAiInFlight, {
      userId: user._id,
    })
    if (!acquired) {
      throw new ConvexError({
        code: "AI_BUSY",
        message: "Another summary is already being generated. Please wait.",
      })
    }

    try {
      const day = new Date().toISOString().slice(0, 10)
      const used = await ctx.runQuery(internal.ai.getAiUsageDaily, {
        userId: user._id,
        day,
      })
      if (used >= AI_DAILY_LIMIT) {
        throw new ConvexError({
          code: "AI_LIMIT_REACHED",
          message:
            "You’ve reached today’s AI summary limit. Please try again tomorrow.",
        })
      }

      await ctx.runMutation(internal.ai.setLastSummaryRequestAt, {
        userNewsletterId,
        at: Date.now(),
      })

      return await generateSummaryWithExistingLogic(ctx, {
        userNewsletterId,
        forceRegenerate,
        newsletter,
        day,
        userId: user._id,
      })
    } finally {
      await ctx.runMutation(internal.ai.releaseAiInFlight, { userId: user._id })
    }
  },
})

async function generateSummaryWithExistingLogic(
  ctx: any,
  args: {
    userNewsletterId: Id<"userNewsletters">
    forceRegenerate?: boolean
    newsletter: any
    day: string
    userId: Id<"users">
  }
): Promise<{ summary: string; isShared: boolean }> {
  // Get newsletter content (validates access internally)
  const result = await ctx.runAction(internal.newsletters.getUserNewsletterWithContentInternal, {
    userNewsletterId: args.userNewsletterId,
  })

  if (result.contentStatus !== "available" || !result.contentUrl) {
    throw new ConvexError({
      code: "CONTENT_UNAVAILABLE",
      message: "Newsletter content is not available for summarization",
    })
  }

  // Fetch content from R2
  const response = await fetch(result.contentUrl)
  if (!response.ok) {
    throw new ConvexError({
      code: "CONTENT_FETCH_ERROR",
      message: "Failed to fetch newsletter content",
    })
  }

  const html = await response.text()

  // Strip HTML to plain text (reduce tokens, cleaner input)
  const plainText = stripHtmlToText(html)

  // Truncate to reasonable length (prevent token overflow)
  const truncatedText = plainText.slice(0, MAX_CONTENT_LENGTH)

  // Get API key from environment
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new ConvexError({
      code: "AI_CONFIG_ERROR",
      message: "AI service is not configured",
    })
  }

  try {
    const summary = await generateCompletion(
      {
        apiKey,
        model: "openai/gpt-oss-120b",
        timeout: 25000, // 25s timeout (NFR3: 10s target, allow buffer for edge cases)
      },
      SUMMARY_SYSTEM_PROMPT,
      `Summarize this newsletter:\n\n${truncatedText}`
    )

    // Determine where to store the summary
    const isFirstGenerationForPublic =
      !args.forceRegenerate && !args.newsletter.isPrivate && args.newsletter.contentId

    if (isFirstGenerationForPublic) {
      // FIRST GENERATION (PUBLIC): Store on shared newsletterContent (benefits all users)
      await ctx.runMutation(internal.ai.storeSharedSummary, {
        contentId: args.newsletter.contentId as Id<"newsletterContent">,
        summary,
      })
      await ctx.runMutation(internal.ai.incrementAiUsageDaily, {
        userId: args.userId,
        day: args.day,
      })
      return { summary, isShared: true }
    }

    // REGENERATION or PRIVATE: Store on user's record (personal summary)
    await ctx.runMutation(internal.ai.storePrivateSummary, {
      userNewsletterId: args.userNewsletterId,
      summary,
    })
    await ctx.runMutation(internal.ai.incrementAiUsageDaily, {
      userId: args.userId,
      day: args.day,
    })
    return { summary, isShared: false }
  } catch (error) {
    if (error instanceof Error && error.message === "AI_TIMEOUT") {
      throw new ConvexError({
        code: "AI_TIMEOUT",
        message: "Summary generation took too long. Please try again.",
      })
    }

    // Re-throw ConvexErrors (from content fetch, etc.)
    if (error instanceof ConvexError) {
      throw error
    }

    console.error("[generateSummary] AI error:", error)
    throw new ConvexError({
      code: "AI_UNAVAILABLE",
      message: "AI service is temporarily unavailable. Please try again later.",
    })
  }
}

/**
 * Get summary for a newsletter (resolves personal vs shared)
 * Story 5.1: Task 4 - Public query for summary retrieval
 *
 * Resolution Priority:
 * 1. Personal summary (userNewsletters.summary) - if user regenerated
 * 2. Shared summary (newsletterContent.summary) - for public newsletters
 * 3. null - no summary available
 */
export const getNewsletterSummary = query({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (
    ctx,
    { userNewsletterId }
  ): Promise<{
    summary: string | null
    isShared: boolean
    generatedAt: number | null
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { summary: null, isShared: false, generatedAt: null }
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) {
      return { summary: null, isShared: false, generatedAt: null }
    }

    if (!isUserPro({ plan: user.plan ?? "free", proExpiresAt: user.proExpiresAt })) {
      throw new ConvexError({
        code: "PRO_REQUIRED",
        message: "Hushletter Pro is required for AI summaries.",
      })
    }

    const newsletter = await ctx.db.get("userNewsletters", userNewsletterId)
    if (!newsletter) {
      return { summary: null, isShared: false, generatedAt: null }
    }

    // Privacy check
    if (newsletter.userId !== user._id) {
      return { summary: null, isShared: false, generatedAt: null }
    }

    // Priority 1: Personal summary (userNewsletters)
    if (newsletter.summary) {
      return {
        summary: newsletter.summary,
        isShared: false,
        generatedAt: newsletter.summaryGeneratedAt ?? null,
      }
    }

    // Priority 2: Shared summary (public newsletters only)
    if (!newsletter.isPrivate && newsletter.contentId) {
      const content = await ctx.db.get("newsletterContent", newsletter.contentId)
      if (content?.summary) {
        return {
          summary: content.summary,
          isShared: true,
          generatedAt: content.summaryGeneratedAt ?? null,
        }
      }
    }

    // No summary available
    return { summary: null, isShared: false, generatedAt: null }
  },
})

// ============================================================
// Internal Functions (not exposed to client)
// ============================================================

/**
 * Internal query to get newsletter metadata for summary logic
 * Story 5.1: Task 3.2 - Get newsletter to determine storage path
 */
export const getNewsletterForSummary = internalQuery({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, { userNewsletterId }) => {
    return await ctx.db.get("userNewsletters", userNewsletterId)
  },
})

/**
 * Internal query to check for existing shared summary
 * Story 5.1: Task 3.3 - Check shared summary before API call
 */
export const getSharedSummary = internalQuery({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, { contentId }) => {
    const content = await ctx.db.get("newsletterContent", contentId)
    return content?.summary ?? null
  },
})

/**
 * Internal mutation to store SHARED summary (public newsletters)
 * Story 5.1: Task 3.8 - First generation stores on newsletterContent
 */
export const storeSharedSummary = internalMutation({
  args: {
    contentId: v.id("newsletterContent"),
    summary: v.string(),
  },
  handler: async (ctx, { contentId, summary }) => {
    await ctx.db.patch("newsletterContent", contentId, {
      summary,
      summaryGeneratedAt: Date.now(),
    })
  },
})

/**
 * Internal mutation to store PRIVATE/PERSONAL summary
 * Story 5.1: Task 3.8 - Regeneration or private stores on userNewsletters
 */
export const storePrivateSummary = internalMutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    summary: v.string(),
  },
  handler: async (ctx, { userNewsletterId, summary }) => {
    await ctx.db.patch("userNewsletters", userNewsletterId, {
      summary,
      summaryGeneratedAt: Date.now(),
    })
  },
})

export const setLastSummaryRequestAt = internalMutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("userNewsletters", args.userNewsletterId, {
      lastSummaryRequestAt: args.at,
    })
  },
})

export const getAiUsageDaily = internalQuery({
  args: { userId: v.id("users"), day: v.string() },
  handler: async (ctx, args): Promise<number> => {
    const existing = await ctx.db
      .query("aiUsageDaily")
      .withIndex("by_userId_day", (q) => q.eq("userId", args.userId).eq("day", args.day))
      .first()
    return existing?.count ?? 0
  },
})

export const incrementAiUsageDaily = internalMutation({
  args: { userId: v.id("users"), day: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiUsageDaily")
      .withIndex("by_userId_day", (q) => q.eq("userId", args.userId).eq("day", args.day))
      .first()

    if (!existing) {
      await ctx.db.insert("aiUsageDaily", {
        userId: args.userId,
        day: args.day,
        count: 1,
        updatedAt: Date.now(),
      })
      return
    }

    await ctx.db.patch("aiUsageDaily", existing._id, {
      count: existing.count + 1,
      updatedAt: Date.now(),
    })
  },
})

export const tryAcquireAiInFlight = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await ctx.db
      .query("aiInFlight")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first()

    if (existing) return false

    await ctx.db.insert("aiInFlight", {
      userId: args.userId,
      startedAt: Date.now(),
    })
    return true
  },
})

export const releaseAiInFlight = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiInFlight")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first()
    if (existing) {
      await ctx.db.delete("aiInFlight", existing._id)
    }
  },
})

// ============================================================
// Helper Functions
// ============================================================

/** Maximum characters to send to AI (prevents token overflow) */
export const MAX_CONTENT_LENGTH = 15000 // ~4 chars per token ≈ 3750 tokens

/**
 * HTML entity mapping for decoding
 * Covers common entities found in newsletters
 * Using Unicode escapes for special characters to ensure cross-platform compatibility
 */
const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&mdash;": "\u2014", // —
  "&ndash;": "\u2013", // –
  "&hellip;": "\u2026", // …
  "&copy;": "\u00A9", // ©
  "&reg;": "\u00AE", // ®
  "&trade;": "\u2122", // ™
  "&bull;": "\u2022", // •
  "&middot;": "\u00B7", // ·
  "&lsquo;": "\u2018", // '
  "&rsquo;": "\u2019", // '
  "&ldquo;": "\u201C", // "
  "&rdquo;": "\u201D", // "
  "&euro;": "\u20AC", // €
  "&pound;": "\u00A3", // £
  "&yen;": "\u00A5", // ¥
  "&cent;": "\u00A2", // ¢
  "&deg;": "\u00B0", // °
  "&plusmn;": "\u00B1", // ±
  "&times;": "\u00D7", // ×
  "&divide;": "\u00F7", // ÷
  "&frac12;": "\u00BD", // ½
  "&frac14;": "\u00BC", // ¼
  "&frac34;": "\u00BE", // ¾
}

/**
 * Strip HTML tags and normalize whitespace for AI processing
 * Story 5.1: Task 3.5 - Clean HTML for better AI context
 *
 * Removes scripts, styles, HTML tags, and normalizes whitespace
 * to produce clean plain text for the AI model.
 *
 * @internal Exported for testing purposes
 */
export function stripHtmlToText(html: string): string {
  return (
    html
      // Remove script and style content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      // Replace common block elements with newlines
      .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n")
      // Remove all remaining HTML tags
      .replace(/<[^>]+>/g, "")
      // Decode named HTML entities
      .replace(/&[a-zA-Z]+;/g, (entity) => HTML_ENTITIES[entity] ?? entity)
      // Decode numeric HTML entities (decimal)
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      // Decode numeric HTML entities (hex)
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  )
}
