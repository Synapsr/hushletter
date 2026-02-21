import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  action,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "./r2";
import type { Doc, Id } from "./_generated/dataModel";
import {
  normalizeForHash,
  computeContentHash,
} from "./_internal/contentNormalization";
import {
  HARD_NEWSLETTERS_CAP,
  UNLOCKED_NEWSLETTERS_CAP,
  isUserPro,
} from "./entitlements";

/** Content availability status for newsletters */
export type ContentStatus = "available" | "missing" | "error" | "locked";

/**
 * Lightweight shape for newsletter list UIs.
 *
 * Important: userNewsletters can include large optional fields (e.g. `summary`).
 * Most list UIs only need metadata plus `hasSummary`, so we intentionally omit
 * summary text to reduce bandwidth.
 */
type NewsletterListItem = {
  _id: Id<"userNewsletters">;
  subject: string;
  senderEmail: string;
  senderName?: string;
  receivedAt: number;
  isRead: boolean;
  isHidden: boolean;
  isBinned?: boolean;
  isPrivate: boolean;
  isLockedByPlan: boolean;
  readProgress?: number;
  hasSummary: boolean;
  source?: "email" | "gmail" | "manual" | "community";
  isFavorited?: boolean;
  folderId?: string;
};

type NewsletterListPageResult = {
  page: NewsletterListItem[];
  isDone: boolean;
  continueCursor: string | null;
};

function toNewsletterListItem(
  newsletter: {
    _id: Id<"userNewsletters">;
    subject: string;
    senderEmail: string;
    senderName?: string;
    receivedAt: number;
    isRead: boolean;
    isHidden: boolean;
    isBinned?: boolean;
    isPrivate: boolean;
    isLockedByPlan?: boolean;
    readProgress?: number;
    source?: "email" | "gmail" | "manual" | "community";
    isFavorited?: boolean;
    folderId?: Id<"folders">;
  },
  hasSummary: boolean,
): NewsletterListItem {
  return {
    _id: newsletter._id,
    subject: newsletter.subject,
    senderEmail: newsletter.senderEmail,
    senderName: newsletter.senderName,
    receivedAt: newsletter.receivedAt,
    isRead: newsletter.isRead,
    isHidden: newsletter.isHidden,
    isBinned: newsletter.isBinned,
    isPrivate: newsletter.isPrivate,
    isLockedByPlan: Boolean(newsletter.isLockedByPlan),
    readProgress: newsletter.readProgress,
    hasSummary,
    source: newsletter.source,
    isFavorited: newsletter.isFavorited,
    folderId: newsletter.folderId as string | undefined,
  };
}

async function enrichNewsletterListItems(
  ctx: { db: { get: (table: "newsletterContent", id: any) => Promise<any> } },
  newsletters: Array<Doc<"userNewsletters">>,
): Promise<NewsletterListItem[]> {
  const contentIds = newsletters
    .filter((n) => !n.isPrivate && n.contentId && !n.summary)
    .map((n) => n.contentId!);

  const uniqueContentIds = [...new Set(contentIds)];
  const contents = await Promise.all(
    uniqueContentIds.map((id) => ctx.db.get("newsletterContent", id)),
  );
  const contentMap = new Map(
    contents
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => [c._id, c]),
  );

  return newsletters.map((newsletter) => {
    let hasSummary = Boolean(newsletter.summary);

    if (!hasSummary && !newsletter.isPrivate && newsletter.contentId) {
      const content = contentMap.get(newsletter.contentId);
      hasSummary = Boolean(content?.summary);
    }

    return toNewsletterListItem(newsletter, hasSummary);
  });
}

async function upsertNewsletterReadProgress(
  ctx: {
    db: {
      query: (table: "newsletterReadProgress") => any;
      patch: (
        table: "newsletterReadProgress",
        id: any,
        value: any,
      ) => Promise<void>;
      insert: (table: "newsletterReadProgress", value: any) => Promise<any>;
    };
  },
  args: {
    userId: Id<"users">;
    userNewsletterId: Id<"userNewsletters">;
    progress: number;
  },
) {
  const existing = await ctx.db
    .query("newsletterReadProgress")
    .withIndex("by_userId_userNewsletterId", (q: any) =>
      q.eq("userId", args.userId).eq("userNewsletterId", args.userNewsletterId),
    )
    .first();

  if (existing) {
    await ctx.db.patch("newsletterReadProgress", existing._id, {
      progress: args.progress,
      updatedAt: Date.now(),
    });
    return;
  }

  await ctx.db.insert("newsletterReadProgress", {
    userId: args.userId,
    userNewsletterId: args.userNewsletterId,
    progress: args.progress,
    updatedAt: Date.now(),
  });
}

async function getSearchMetaDoc(
  ctx: { db: { query: (table: "newsletterSearchMeta") => any } },
  userId: Id<"users">,
  userNewsletterId: Id<"userNewsletters">,
): Promise<Doc<"newsletterSearchMeta"> | null> {
  return await ctx.db
    .query("newsletterSearchMeta")
    .withIndex("by_userId_userNewsletterId", (q: any) =>
      q.eq("userId", userId).eq("userNewsletterId", userNewsletterId),
    )
    .first();
}

async function getHiddenFolderIdSet(
  ctx: { db: { query: (table: "folders") => any } },
  userId: Id<"users">,
): Promise<Set<Id<"folders">>> {
  const folders = await ctx.db
    .query("folders")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();

  return new Set(
    folders
      .filter((folder: any) => folder.isHidden)
      .map((folder: any) => folder._id),
  );
}

const DEFAULT_RECENT_UNREAD_WINDOW_DAYS = 7;
const NEWSLETTER_R2_CACHE_CONTROL = "private, max-age=3600";

function getRecentUnreadWindowStart(
  lastConnectedAt: number | undefined,
  nowTs: number,
): number {
  const normalizedNow =
    typeof nowTs === "number" && Number.isFinite(nowTs) ? Math.max(0, nowTs) : 0;
  const windowStartByDays =
    normalizedNow - DEFAULT_RECENT_UNREAD_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const normalizedLastConnectedAt =
    typeof lastConnectedAt === "number" && Number.isFinite(lastConnectedAt)
      ? Math.max(0, Math.min(lastConnectedAt, normalizedNow))
      : 0;
  return Math.max(normalizedLastConnectedAt, windowStartByDays);
}

/**
 * Store newsletter content in R2 and create userNewsletter record
 * Called from emailIngestion HTTP action
 *
 * Story 2.5.1: Updated for new schema with public/private content paths
 * Story 2.5.2: Added content deduplication via normalization + SHA-256 hashing
 * Story 8.4: Added duplicate detection via messageId and content hash
 * Story 9.2: PRIVATE-BY-DEFAULT - All user newsletters are now stored privately.
 *   - Removed isPrivate parameter (always private for user ingestion)
 *   - Added source parameter to track ingestion origin
 *   - Added folderId parameter (required for folder-centric architecture)
 *   - Removed PUBLIC PATH deduplication to newsletterContent
 *   - newsletterContent is now ONLY created by admin curation (Story 9.7)
 *
 * DUPLICATE DETECTION (Story 8.4):
 * Before any storage, checks if this is a duplicate:
 * 1. Check by messageId (most reliable - globally unique per RFC 5322)
 * 2. Check by content hash for same user (user-level dedup only)
 * If duplicate found, returns { skipped: true } without storage.
 */
export const storeNewsletterContent = internalAction({
  args: {
    userId: v.id("users"),
    senderId: v.id("senders"),
    folderId: v.id("folders"), // Story 9.2: Required for folder-centric architecture
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
    htmlContent: v.optional(v.string()),
    textContent: v.optional(v.string()),
    // Story 9.2: Track ingestion source (replaces isPrivate)
    source: v.union(
      v.literal("email"),
      v.literal("gmail"),
      v.literal("manual"),
      v.literal("community"),
    ),
    // Story 8.4: Email Message-ID header for duplicate detection
    messageId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | {
        userNewsletterId: Id<"userNewsletters">;
        r2Key: string;
        skipped?: false;
      }
    | {
        skipped: true;
        reason: "duplicate";
        duplicateReason: "message_id" | "content_hash";
        existingId: Id<"userNewsletters">;
      }
    | {
        skipped: true;
        reason: "plan_limit";
        hardCap: number;
      }
  > => {
    console.log(
      `[newsletters] storeNewsletterContent called: user=${args.userId}, sender=${args.senderId}, ` +
        `subject="${args.subject.substring(0, 50)}...", source=${args.source}, ` +
        `folderId=${args.folderId}, htmlLen=${args.htmlContent?.length || 0}, ` +
        `textLen=${args.textContent?.length || 0}, messageId=${args.messageId || "none"}`,
    );

    // ========================================
    // DUPLICATE DETECTION (Story 8.4)
    // Check BEFORE any expensive R2 operations
    // ========================================

    // Step 1: Check by messageId (most reliable)
    if (args.messageId) {
      const existingByMessageId = await ctx.runQuery(
        internal._internal.duplicateDetection.checkDuplicateByMessageId,
        { userId: args.userId, messageId: args.messageId },
      );
      if (existingByMessageId) {
        console.log(
          `[newsletters] Duplicate detected by messageId: ${args.messageId}, existing=${existingByMessageId}`,
        );
        return {
          skipped: true,
          reason: "duplicate",
          duplicateReason: "message_id",
          existingId: existingByMessageId,
        };
      }
    }

    const content = args.htmlContent || args.textContent || "";

    // Handle empty content gracefully - use subject as minimal content
    // This prevents all empty emails from deduplicating to the same hash
    const effectiveContent = content.trim() || `<p>${args.subject}</p>`;
    const hasOriginalContent = content.trim().length > 0;

    if (!hasOriginalContent) {
      console.log(
        `[newsletters] Empty content detected, using subject as fallback: "${args.subject}"`,
      );
    }

    // Pre-compute content hash for user-level duplicate detection
    const normalized = normalizeForHash(effectiveContent);
    const contentHash = await computeContentHash(normalized);

    // Step 2: Check by content hash for THIS USER ONLY (user-level dedup)
    // Story 9.2: All newsletters are private, so we only check user's own content
    const existingByHash = await ctx.runQuery(
      internal._internal.duplicateDetection.checkDuplicateByContentHash,
      { userId: args.userId, contentHash, isPrivate: true },
    );
    if (existingByHash) {
      console.log(
        `[newsletters] Duplicate detected by contentHash for user: ${contentHash.substring(0, 8)}..., existing=${existingByHash}`,
      );
      return {
        skipped: true,
        reason: "duplicate",
        duplicateReason: "content_hash",
        existingId: existingByHash,
      };
    }

    // ========================================
    // PLAN LIMITS (Free → Pro)
    // Enforce BEFORE any expensive R2 operations
    // ========================================
    const entitlements = await ctx.runQuery(
      internal.entitlements.getUserEntitlementsByUserId,
      { userId: args.userId },
    );

    let isLockedByPlan = false;

    if (!entitlements.isPro) {
      let usage = await ctx.runQuery(
        internal.entitlements.getUserUsageCounters,
        {
          userId: args.userId,
        },
      );

      if (!usage) {
        const fallback = await ctx.runQuery(
          internal.entitlements.computeUserUsageCountersFallback,
          { userId: args.userId },
        );
        usage = {
          totalStored: fallback.totalStored,
          unlockedStored: fallback.unlockedStored,
          lockedStored: fallback.lockedStored,
        };
        await ctx.runMutation(internal.entitlements.upsertUserUsageCounters, {
          userId: args.userId,
          totalStored: usage.totalStored,
          unlockedStored: usage.unlockedStored,
          lockedStored: usage.lockedStored,
        });
      }

      if (usage.totalStored >= HARD_NEWSLETTERS_CAP) {
        console.log(
          `[newsletters] Plan limit: user already at hard cap (totalStored=${usage.totalStored})`,
        );
        return {
          skipped: true,
          reason: "plan_limit",
          hardCap: HARD_NEWSLETTERS_CAP,
        };
      }

      isLockedByPlan = usage.unlockedStored >= UNLOCKED_NEWSLETTERS_CAP;
    }

    const contentType = args.htmlContent ? "text/html" : "text/plain";
    const ext = args.htmlContent ? "html" : "txt";

    // ========================================
    // PRIVATE-BY-DEFAULT PATH (Story 9.2)
    // All user newsletters stored with privateR2Key
    // ========================================
    const timestamp = Date.now();
    const randomId = crypto.randomUUID();
    const r2Key = `private/${args.userId}/${timestamp}-${randomId}.${ext}`;

    // Upload to R2 (store original content, even if empty)
    try {
      console.log(
        `[newsletters] Uploading private content to R2: key=${r2Key}, size=${effectiveContent.length}`,
      );
      await r2.r2.send(
        new PutObjectCommand({
          Bucket: r2.config.bucket,
          Key: r2Key,
          Body: effectiveContent,
          ContentType: `${contentType}; charset=utf-8`,
          CacheControl: NEWSLETTER_R2_CACHE_CONTROL,
        }),
      );
      // Keep component metadata in sync (same behavior as r2.store).
      await r2.syncMetadata(ctx, r2Key);
      console.log(`[newsletters] R2 upload successful: ${r2Key}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `[newsletters] R2 upload failed for private content: key=${r2Key}, error=${errorMsg}`,
        error,
      );
      throw new ConvexError({
        code: "R2_UPLOAD_FAILED",
        message: `Failed to store newsletter content in R2: ${errorMsg}`,
      });
    }

    // Create userNewsletter with privateR2Key (no contentId - Story 9.2)
    const userNewsletterId = await ctx.runMutation(
      internal.newsletters.createUserNewsletter,
      {
        userId: args.userId,
        senderId: args.senderId,
        folderId: args.folderId, // Story 9.2: Required
        subject: args.subject,
        senderEmail: args.senderEmail,
        senderName: args.senderName,
        receivedAt: args.receivedAt,
        isPrivate: true, // Story 9.2: Always true for user ingestion
        isLockedByPlan,
        privateR2Key: r2Key,
        contentId: undefined, // Story 9.2: Never set for user ingestion
        source: args.source, // Story 9.2: Track ingestion source
        messageId: args.messageId, // Story 8.4: For duplicate detection
      },
    );

    await ctx.runMutation(internal.entitlements.incrementUserUsageCounters, {
      userId: args.userId,
      totalDelta: 1,
      unlockedDelta: isLockedByPlan ? 0 : 1,
      lockedDelta: isLockedByPlan ? 1 : 0,
    });

    // Increment sender.newsletterCount after successful storage
    await ctx.runMutation(internal.senders.incrementNewsletterCount, {
      senderId: args.senderId,
    });

    console.log(
      `[newsletters] Private content stored: ${r2Key}, user=${args.userId}, source=${args.source}`,
    );

    return { userNewsletterId, r2Key };
  },
});

/**
 * Create a new newsletterContent entry for shared public content
 * Story 2.5.1: New function for shared content schema
 * Story 2.5.2: Now requires contentHash (SHA-256 of normalized content)
 * Story 9.2: NOW ADMIN-ONLY - Used only for admin curation (Story 9.7)
 *   User ingestion no longer creates newsletterContent records.
 *   All user newsletters use privateR2Key instead.
 *
 * RACE CONDITION HANDLING: If another request created content with the same
 * hash between our lookup and this mutation, we detect it and return the
 * existing content instead of creating a duplicate.
 *
 * @deprecated For user ingestion - use storeNewsletterContent which always stores privately.
 * This function is reserved for admin curation workflow (Story 9.7).
 */
export const createNewsletterContent = internalMutation({
  args: {
    contentHash: v.string(), // Required: SHA-256 of normalized content
    r2Key: v.string(),
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Race condition check: verify hash doesn't exist (could have been created
    // between the action's query and this mutation)
    const existing = await ctx.db
      .query("newsletterContent")
      .withIndex("by_contentHash", (q) => q.eq("contentHash", args.contentHash))
      .first();

    if (existing) {
      // Another request created this content - increment readerCount and return existing
      await ctx.db.patch("newsletterContent", existing._id, {
        readerCount: existing.readerCount + 1,
      });
      console.log(
        `[newsletters] Race condition handled: reusing existing content ${existing._id}`,
      );
      return existing._id;
    }

    const contentId = await ctx.db.insert("newsletterContent", {
      contentHash: args.contentHash,
      r2Key: args.r2Key,
      subject: args.subject,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      firstReceivedAt: args.receivedAt,
      readerCount: 1, // First reader
    });

    return contentId;
  },
});

/**
 * Find newsletterContent by content hash (for deduplication lookup)
 * Story 2.5.2: Task 3 - Deduplication lookup via by_contentHash index
 * Story 9.2: NOW ADMIN-ONLY - Used only for admin curation (Story 9.7)
 *   User ingestion no longer uses cross-user content deduplication.
 *
 * @deprecated For user ingestion - storeNewsletterContent now uses user-level
 * duplicate detection only. This function is reserved for admin curation workflow.
 */
export const findByContentHash = internalQuery({
  args: { contentHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterContent")
      .withIndex("by_contentHash", (q) => q.eq("contentHash", args.contentHash))
      .first();
  },
});

/**
 * Increment readerCount when content is reused (dedup hit)
 * Story 2.5.2: Task 3 - Atomic increment for deduplication metrics
 * Story 9.2: NOW ADMIN-ONLY - Used only for admin curation (Story 9.7)
 *   User ingestion no longer uses cross-user content deduplication.
 *
 * Note: Throws if content not found (consistent with incrementNewsletterCount
 * in senders.ts). A missing contentId indicates a bug in the calling code.
 *
 * @deprecated For user ingestion - storeNewsletterContent no longer uses
 * shared content deduplication. This function is reserved for admin curation
 * workflow when users import from community content.
 */
export const incrementReaderCount = internalMutation({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, args) => {
    const content = await ctx.db.get("newsletterContent", args.contentId);
    if (!content) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter content not found",
      });
    }
    await ctx.db.patch("newsletterContent", args.contentId, {
      readerCount: content.readerCount + 1,
    });
  },
});

/**
 * Create a new userNewsletter entry
 * Story 2.5.1: Updated for new schema
 * Story 8.4: Added messageId field for duplicate detection
 * Story 9.2: Added source and folderId fields for private-by-default architecture
 */
export const createUserNewsletter = internalMutation({
  args: {
    userId: v.id("users"),
    senderId: v.id("senders"),
    folderId: v.id("folders"), // Story 9.2: Required for folder-centric architecture
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
    isPrivate: v.boolean(),
    isLockedByPlan: v.optional(v.boolean()),
    contentId: v.optional(v.id("newsletterContent")),
    privateR2Key: v.optional(v.string()),
    // Story 9.2: Track ingestion source
    source: v.union(
      v.literal("email"),
      v.literal("gmail"),
      v.literal("manual"),
      v.literal("community"),
    ),
    // Story 8.4: Email Message-ID header for duplicate detection
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userNewsletterId = await ctx.db.insert("userNewsletters", {
      userId: args.userId,
      senderId: args.senderId,
      folderId: args.folderId, // Story 9.2: Required
      contentId: args.contentId,
      privateR2Key: args.privateR2Key,
      subject: args.subject,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      receivedAt: args.receivedAt,
      isRead: false,
      isHidden: false,
      isBinned: false,
      isFavorited: false,
      isPrivate: args.isPrivate,
      isLockedByPlan: args.isLockedByPlan ?? false,
      source: args.source, // Story 9.2: Track ingestion source
      messageId: args.messageId, // Story 8.4: Store for duplicate detection
    });

    await ctx.db.insert("newsletterSearchMeta", {
      userId: args.userId,
      userNewsletterId,
      subject: args.subject,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      receivedAt: args.receivedAt,
      isHidden: false,
      isBinned: false,
      isRead: false,
      isLockedByPlan: args.isLockedByPlan ?? false,
    });

    return userNewsletterId;
  },
});

/**
 * Get userNewsletter metadata (without content URL)
 * Use getUserNewsletterWithContent action if you need the signed URL
 * Story 2.5.1: Updated for userNewsletters table
 */
export const getUserNewsletter = query({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const userNewsletter = await ctx.db.get("userNewsletters", args.userNewsletterId);
    if (!userNewsletter) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter not found",
      });
    }

    // Get user record to check permissions
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    // Privacy check - user can only access their own newsletters
    // (Community access to public content will be added in Epic 6)
    if (userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    }

    const isPro = isUserPro({
      plan: user.plan ?? "free",
      proExpiresAt: user.proExpiresAt,
    });

    // Determine content status
    let contentStatus: ContentStatus =
      userNewsletter.contentId || userNewsletter.privateR2Key
        ? "available"
        : "missing";

    if (!isPro && userNewsletter.isLockedByPlan) {
      contentStatus = "locked";
    }

    const progressDoc = await ctx.db
      .query("newsletterReadProgress")
      .withIndex("by_userId_userNewsletterId", (q) =>
        q.eq("userId", user._id).eq("userNewsletterId", args.userNewsletterId),
      )
      .first();

    const effectiveReadProgress =
      progressDoc?.progress ?? userNewsletter.readProgress;

    return {
      ...userNewsletter,
      readProgress: effectiveReadProgress,
      contentStatus,
    };
  },
});

/** Return type for getUserNewsletterWithContent action */
type UserNewsletterWithContentResult = {
  _id: Id<"userNewsletters">;
  _creationTime: number;
  userId: Id<"users">;
  senderId: Id<"senders">;
  contentId?: Id<"newsletterContent">;
  privateR2Key?: string;
  subject: string;
  senderEmail: string;
  senderName?: string;
  receivedAt: number;
  isRead: boolean;
  isHidden: boolean;
  isFavorited?: boolean;
  isPrivate: boolean;
  readProgress?: number;
  contentUrl: string | null;
  contentStatus: ContentStatus;
};

/**
 * Get userNewsletter with signed R2 URL for content
 * This is an action because r2.getUrl() makes external API calls
 * Story 2.5.1: Updated for userNewsletters table with public/private paths
 */
async function getUserNewsletterWithContentImpl(
  ctx: Pick<ActionCtx, "auth" | "runQuery">,
  args: { userNewsletterId: Id<"userNewsletters"> },
): Promise<UserNewsletterWithContentResult> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  // Get userNewsletter via internal query
  const userNewsletter = await ctx.runQuery(
    internal.newsletters.getUserNewsletterInternal,
    {
      userNewsletterId: args.userNewsletterId,
    },
  );

  if (!userNewsletter) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Newsletter not found",
    });
  }

  // Get user record to check permissions
  const user = await ctx.runQuery(internal._internal.users.findByAuthId, {
    authId: identity.subject,
  });

  if (!user) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  // Privacy check - user can only access their own newsletters
  if (userNewsletter.userId !== user._id) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
  }

  const isPro = isUserPro({
    plan: user.plan ?? "free",
    proExpiresAt: user.proExpiresAt,
  });

  if (!isPro && userNewsletter.isLockedByPlan) {
    const progressDoc = await ctx.runQuery(
      internal.newsletters.getNewsletterReadProgressInternal,
      { userId: user._id, userNewsletterId: args.userNewsletterId },
    );
    const effectiveReadProgress =
      progressDoc?.progress ?? userNewsletter.readProgress;

    return {
      ...userNewsletter,
      readProgress: effectiveReadProgress,
      contentUrl: null,
      contentStatus: "locked",
    };
  }

  // Determine R2 key based on public/private path
  let r2Key: string | null = null;

  if (userNewsletter.isPrivate && userNewsletter.privateR2Key) {
    // Private content - use privateR2Key directly
    r2Key = userNewsletter.privateR2Key;
  } else if (!userNewsletter.isPrivate && userNewsletter.contentId) {
    // Public content - get R2 key from newsletterContent
    const content = await ctx.runQuery(
      internal.newsletters.getNewsletterContentInternal,
      {
        contentId: userNewsletter.contentId,
      },
    );
    if (content) {
      r2Key = content.r2Key;
    }
  }

  // Generate signed URL for R2 content (valid for 1 hour)
  let contentUrl: string | null = null;
  let contentStatus: ContentStatus = "missing";

  if (r2Key) {
    try {
      contentUrl = await r2.getUrl(r2Key, { expiresIn: 3600 });
      contentStatus = "available";
    } catch (error) {
      console.error("[newsletters] Failed to generate R2 signed URL:", error);
      contentStatus = "error";
    }
  }

  const progressDoc = await ctx.runQuery(
    internal.newsletters.getNewsletterReadProgressInternal,
    { userId: user._id, userNewsletterId: args.userNewsletterId },
  );
  const effectiveReadProgress =
    progressDoc?.progress ?? userNewsletter.readProgress;

  return {
    ...userNewsletter,
    readProgress: effectiveReadProgress,
    contentUrl,
    contentStatus,
  };
}

export const getUserNewsletterWithContent = action({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, args): Promise<UserNewsletterWithContentResult> => {
    return await getUserNewsletterWithContentImpl(ctx, args);
  },
});

export const getUserNewsletterWithContentInternal = internalAction({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, args): Promise<UserNewsletterWithContentResult> => {
    return await getUserNewsletterWithContentImpl(ctx, args);
  },
});

/**
 * Internal query to get userNewsletter without auth checks
 * Used by getUserNewsletterWithContent action
 */
export const getUserNewsletterInternal = internalQuery({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, args) => {
    return await ctx.db.get("userNewsletters", args.userNewsletterId);
  },
});

/**
 * Internal query to get newsletterContent without auth checks
 * Used by getUserNewsletterWithContent action
 */
export const getNewsletterContentInternal = internalQuery({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, args) => {
    return await ctx.db.get("newsletterContent", args.contentId);
  },
});

export const getNewsletterReadProgressInternal = internalQuery({
  args: {
    userId: v.id("users"),
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterReadProgress")
      .withIndex("by_userId_userNewsletterId", (q) =>
        q
          .eq("userId", args.userId)
          .eq("userNewsletterId", args.userNewsletterId),
      )
      .first();
  },
});

/**
 * List userNewsletters for current user
 * Story 2.5.1: Updated to use userNewsletters table
 * Story 3.5: AC2 - Exclude hidden newsletters from main list
 * Story 5.2: Task 1.1 - Added hasSummary field for summary indicator
 * Story 9.10: Added source field for unified folder view display
 */
export const listUserNewsletters = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user) return [];

    // Story 9.5: Fetch hidden folder IDs to exclude newsletters from hidden folders
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const hiddenFolderIds = new Set(
      folders.filter((f) => f.isHidden).map((f) => f._id),
    );

    // Use by_userId_receivedAt index for proper sorting by receivedAt (AC2)
    // Convex index ordering: when using compound index, order applies to last indexed field
    const newsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_receivedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Story 3.5 AC2: Exclude hidden newsletters from main list
    // Story 9.5 AC6: Exclude newsletters in hidden folders from "All Newsletters"
    const visibleNewsletters = newsletters.filter(
      (n) =>
        !n.isHidden &&
        !n.isBinned &&
        (!n.folderId || !hiddenFolderIds.has(n.folderId)),
    );

    // Story 5.2: Derive hasSummary for each newsletter
    // Code review fix: Batch-fetch contentIds to avoid N+1 queries
    const contentIds = visibleNewsletters
      .filter((n) => !n.isPrivate && n.contentId && !n.summary)
      .map((n) => n.contentId!);

    const uniqueContentIds = [...new Set(contentIds)];
    const contents = await Promise.all(
      uniqueContentIds.map((id) => ctx.db.get("newsletterContent", id)),
    );
    const contentMap = new Map(
      contents
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c]),
    );

    // Privacy pattern: check personal summary first, then shared if public (O(1) lookup)
    // Story 9.10: Include source field for unified folder view display
    const enrichedNewsletters = visibleNewsletters.map((newsletter) => {
      let hasSummary = Boolean(newsletter.summary);

      if (!hasSummary && !newsletter.isPrivate && newsletter.contentId) {
        const content = contentMap.get(newsletter.contentId);
        hasSummary = Boolean(content?.summary);
      }

      return toNewsletterListItem(newsletter, hasSummary);
    });

    return enrichedNewsletters;
  },
});

/**
 * List user newsletters filtered by sender
 * Story 3.1: Task 5 - Support sender-based filtering (AC2, AC3)
 * Story 3.5: AC2 - Exclude hidden newsletters from main list
 * Story 5.2: Task 1.1 - Added hasSummary field for summary indicator
 * Story 9.10: Added source field for unified folder view display
 *
 * If senderId is provided, returns only newsletters from that sender.
 * If senderId is undefined/null, returns all newsletters (same as listUserNewsletters).
 * Results are always sorted by receivedAt descending (newest first).
 *
 * Performance: Uses by_userId_senderId composite index for efficient filtering.
 */
export const listUserNewslettersBySender = query({
  args: {
    senderId: v.optional(v.id("senders")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user) return [];

    let visibleNewsletters;

    if (args.senderId) {
      // Filter by sender using composite index
      const newsletters = await ctx.db
        .query("userNewsletters")
        .withIndex("by_userId_senderId", (q) =>
          q
            .eq("userId", user._id)
            .eq("senderId", args.senderId as Id<"senders">),
        )
        .collect();

      // Story 3.5 AC2: Exclude hidden newsletters, then sort by receivedAt descending
      visibleNewsletters = newsletters
        .filter((n) => !n.isHidden && !n.isBinned)
        .sort((a, b) => b.receivedAt - a.receivedAt);
    } else {
      // No filter - return all non-hidden (existing behavior using proper index)
      const newsletters = await ctx.db
        .query("userNewsletters")
        .withIndex("by_userId_receivedAt", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect();

      // Story 3.5 AC2: Exclude hidden newsletters
      visibleNewsletters = newsletters.filter(
        (n) => !n.isHidden && !n.isBinned,
      );
    }

    // Story 5.2: Derive hasSummary for each newsletter
    // Code review fix: Batch-fetch contentIds to avoid N+1 queries
    const contentIds = visibleNewsletters
      .filter((n) => !n.isPrivate && n.contentId && !n.summary)
      .map((n) => n.contentId!);

    const uniqueContentIds = [...new Set(contentIds)];
    const contents = await Promise.all(
      uniqueContentIds.map((id) => ctx.db.get("newsletterContent", id)),
    );
    const contentMap = new Map(
      contents
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c]),
    );

    // Privacy pattern: check personal summary first, then shared if public (O(1) lookup)
    // Story 9.10: Include source field for unified folder view display
    const enrichedNewsletters = visibleNewsletters.map((newsletter) => {
      let hasSummary = Boolean(newsletter.summary);

      if (!hasSummary && !newsletter.isPrivate && newsletter.contentId) {
        const content = contentMap.get(newsletter.contentId);
        hasSummary = Boolean(content?.summary);
      }

      return toNewsletterListItem(newsletter, hasSummary);
    });

    return enrichedNewsletters;
  },
});

/**
 * List newsletters filtered by folder (all senders in that folder)
 * Story 3.3: AC3 - Browse newsletters by folder
 * Story 3.5: AC2 - Exclude hidden newsletters from main list
 * Story 5.2: Task 1.1 - Added hasSummary field for summary indicator
 * Story 9.10: Added source field for unified folder view display
 *
 * - If folderId is null, returns newsletters from "uncategorized" senders
 *   (senders with no folder assignment)
 * - If folderId is undefined/not provided, returns empty array
 *   (use listUserNewslettersBySender for unfiltered list)
 */
export const listUserNewslettersByFolder = query({
  args: {
    folderId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // If no folderId provided, return empty - caller should use different query
    if (args.folderId === undefined) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user) return [];

    const folderId = args.folderId;

    // Epic 9+ folder-centric schema: newsletters carry folderId directly.
    // This avoids scanning all senders/settings/newsletters to assemble folder views.
    if (folderId === null) {
      // "Uncategorized" is legacy; avoid an expensive full scan.
      return [];
    }

    const newslettersInFolder = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_folderId_receivedAt", (q) =>
        q.eq("userId", user._id).eq("folderId", folderId),
      )
      .order("desc")
      .collect();

    // Story 3.5 AC2: Exclude hidden newsletters
    const filteredNewsletters = newslettersInFolder.filter(
      (n) => !n.isHidden && !n.isBinned,
    );

    // Story 5.2: Batch-fetch contentIds to avoid N+1 queries (code review fix)
    const contentIds = filteredNewsletters
      .filter((n) => !n.isPrivate && n.contentId && !n.summary)
      .map((n) => n.contentId!);

    const uniqueContentIds = [...new Set(contentIds)];
    const contents = await Promise.all(
      uniqueContentIds.map((id) => ctx.db.get("newsletterContent", id)),
    );
    const contentMap = new Map(
      contents
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c]),
    );

    // Derive hasSummary for each newsletter (O(1) lookup)
    const enrichedNewsletters = filteredNewsletters.map((newsletter) => {
      let hasSummary = Boolean(newsletter.summary);
      if (!hasSummary && !newsletter.isPrivate && newsletter.contentId) {
        const content = contentMap.get(newsletter.contentId);
        hasSummary = Boolean(content?.summary);
      }

      return toNewsletterListItem(newsletter, hasSummary);
    });

    return enrichedNewsletters;
  },
});

// ============================================================
// Bandwidth Optimization: Reactive Head + Non-reactive Tail Pagination
// ============================================================

export const listUserNewslettersByFolderHead = query({
  args: {
    folderId: v.id("folders"),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: null };

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();
    if (!user) return { page: [], isDone: true, continueCursor: null };

    const result = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_folderId_receivedAt", (q) =>
        q.eq("userId", user._id).eq("folderId", args.folderId),
      )
      .order("desc")
      .paginate({ numItems: args.numItems ?? 20, cursor: null });

    const visiblePage = result.page.filter((n) => !n.isHidden && !n.isBinned);
    const enriched = await enrichNewsletterListItems(ctx, visiblePage);

    return { ...result, page: enriched };
  },
});

export const listUserNewslettersByFolderPageInternal = internalQuery({
  args: {
    userId: v.id("users"),
    folderId: v.id("folders"),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_folderId_receivedAt", (q) =>
        q.eq("userId", args.userId).eq("folderId", args.folderId),
      )
      .order("desc")
      .paginate({ numItems: args.numItems, cursor: args.cursor });

    const visiblePage = result.page.filter((n) => !n.isHidden && !n.isBinned);
    const enriched = await enrichNewsletterListItems(ctx, visiblePage);

    return { ...result, page: enriched };
  },
});

export const listUserNewslettersByFolderPage = action({
  args: {
    folderId: v.id("folders"),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx, args): Promise<NewsletterListPageResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const user = await ctx.runQuery(internal._internal.users.findByAuthId, {
      authId: identity.subject,
    });
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    return await ctx.runQuery(
      internal.newsletters.listUserNewslettersByFolderPageInternal,
      {
        userId: user._id,
        folderId: args.folderId,
        cursor: args.cursor,
        numItems: args.numItems,
      },
    );
  },
});

export const listAllNewslettersHead = query({
  args: {
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: null };

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();
    if (!user) return { page: [], isDone: true, continueCursor: null };

    const hiddenFolderIds = await getHiddenFolderIdSet(ctx, user._id);

    const result = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_receivedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate({ numItems: args.numItems ?? 30, cursor: null });

    const visiblePage = result.page.filter(
      (n) =>
        !n.isHidden &&
        !n.isBinned &&
        (!n.folderId || !hiddenFolderIds.has(n.folderId)),
    );
    const enriched = await enrichNewsletterListItems(ctx, visiblePage);

    return { ...result, page: enriched };
  },
});

export const listAllNewslettersPageInternal = internalQuery({
  args: {
    userId: v.id("users"),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx, args) => {
    const hiddenFolderIds = await getHiddenFolderIdSet(ctx, args.userId);

    const result = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_receivedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate({ numItems: args.numItems, cursor: args.cursor });

    const visiblePage = result.page.filter(
      (n) =>
        !n.isHidden &&
        !n.isBinned &&
        (!n.folderId || !hiddenFolderIds.has(n.folderId)),
    );
    const enriched = await enrichNewsletterListItems(ctx, visiblePage);

    return { ...result, page: enriched };
  },
});

export const listAllNewslettersPage = action({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx, args): Promise<NewsletterListPageResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const user = await ctx.runQuery(internal._internal.users.findByAuthId, {
      authId: identity.subject,
    });
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    return await ctx.runQuery(
      internal.newsletters.listAllNewslettersPageInternal,
      {
        userId: user._id,
        cursor: args.cursor,
        numItems: args.numItems,
      },
    );
  },
});

export const listRecentUnreadNewslettersHead = query({
  args: {
    lastConnectedAt: v.optional(v.number()),
    numItems: v.optional(v.number()),
    nowTs: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: null };

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();
    if (!user) return { page: [], isDone: true, continueCursor: null };

    const hiddenFolderIds = await getHiddenFolderIdSet(ctx, user._id);
    const windowStart = getRecentUnreadWindowStart(args.lastConnectedAt, args.nowTs);

    const result = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_isRead_isHidden_receivedAt", (q) =>
        q
          .eq("userId", user._id)
          .eq("isRead", false)
          .eq("isHidden", false)
          .gte("receivedAt", windowStart),
      )
      .order("desc")
      .paginate({ numItems: args.numItems ?? 8, cursor: null });

    const visiblePage = result.page.filter(
      (n) => !n.isBinned && (!n.folderId || !hiddenFolderIds.has(n.folderId)),
    );
    const enriched = await enrichNewsletterListItems(ctx, visiblePage);

    return { ...result, page: enriched };
  },
});

export const listRecentUnreadNewslettersPageInternal = internalQuery({
  args: {
    userId: v.id("users"),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
    lastConnectedAt: v.optional(v.number()),
    nowTs: v.number(),
  },
  handler: async (ctx, args) => {
    const hiddenFolderIds = await getHiddenFolderIdSet(ctx, args.userId);
    const windowStart = getRecentUnreadWindowStart(args.lastConnectedAt, args.nowTs);

    const result = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_isRead_isHidden_receivedAt", (q) =>
        q
          .eq("userId", args.userId)
          .eq("isRead", false)
          .eq("isHidden", false)
          .gte("receivedAt", windowStart),
      )
      .order("desc")
      .paginate({ numItems: args.numItems, cursor: args.cursor });

    const visiblePage = result.page.filter(
      (n) => !n.isBinned && (!n.folderId || !hiddenFolderIds.has(n.folderId)),
    );
    const enriched = await enrichNewsletterListItems(ctx, visiblePage);

    return { ...result, page: enriched };
  },
});

export const listRecentUnreadNewslettersPage = action({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
    lastConnectedAt: v.optional(v.number()),
    nowTs: v.number(),
  },
  handler: async (ctx, args): Promise<NewsletterListPageResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const user = await ctx.runQuery(internal._internal.users.findByAuthId, {
      authId: identity.subject,
    });
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    return await ctx.runQuery(
      internal.newsletters.listRecentUnreadNewslettersPageInternal,
      {
        userId: user._id,
        cursor: args.cursor,
        numItems: args.numItems ?? 20,
        lastConnectedAt: args.lastConnectedAt,
        nowTs: args.nowTs,
      },
    );
  },
});

/**
 * Mark userNewsletter as read
 * Story 2.5.1: Updated for userNewsletters table
 */
export const markAsRead = internalMutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    readProgress: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("userNewsletters", args.userNewsletterId, {
      isRead: true,
      readProgress: args.readProgress ?? 100,
    });
  },
});

/**
 * Update read progress for userNewsletter
 * Story 2.5.1: Updated for userNewsletters table
 */
export const updateReadProgress = internalMutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    readProgress: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("userNewsletters", args.userNewsletterId, {
      readProgress: args.readProgress,
      isRead: args.readProgress >= 100,
    });
  },
});

/**
 * Toggle hide status for userNewsletter
 * Story 2.5.1: Updated for userNewsletters table
 */
export const toggleHidden = internalMutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    isHidden: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("userNewsletters", args.userNewsletterId, {
      isHidden: args.isHidden,
    });
  },
});

/**
 * Set read progress for a newsletter (public mutation).
 *
 * Stores progress outside `userNewsletters` so high-frequency updates don't cause
 * list/count queries to re-run.
 */
export const setReadProgress = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    progress: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const userNewsletter = await ctx.db.get("userNewsletters", args.userNewsletterId);
    if (!userNewsletter) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter not found",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    }

    const clampedProgress = Math.max(0, Math.min(100, args.progress));

    await upsertNewsletterReadProgress(ctx, {
      userId: user._id,
      userNewsletterId: args.userNewsletterId,
      progress: clampedProgress,
    });

    // Only update the primary newsletter doc when we transition to "read".
    // Intermediate progress updates must not touch `userNewsletters`.
    if (clampedProgress === 100 && !userNewsletter.isRead) {
      await ctx.db.patch("userNewsletters", args.userNewsletterId, { isRead: true });

      const searchMeta = await getSearchMetaDoc(
        ctx,
        user._id,
        args.userNewsletterId,
      );
      if (!searchMeta) {
        await ctx.db.insert("newsletterSearchMeta", {
          userId: user._id,
          userNewsletterId: args.userNewsletterId,
          subject: userNewsletter.subject,
          senderEmail: userNewsletter.senderEmail,
          senderName: userNewsletter.senderName,
          receivedAt: userNewsletter.receivedAt,
          isHidden: userNewsletter.isHidden,
          isBinned: Boolean(userNewsletter.isBinned),
          isRead: true,
          isLockedByPlan: Boolean(userNewsletter.isLockedByPlan),
        });
      } else if (!searchMeta.isRead) {
        await ctx.db.patch("newsletterSearchMeta", searchMeta._id, { isRead: true });
      }
    }
  },
});

/**
 * Mark newsletter as read (public mutation)
 * Story 3.4: AC3, AC4 - Manual/auto mark as read
 */
export const markNewsletterRead = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    readProgress: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const userNewsletter = await ctx.db.get("userNewsletters", args.userNewsletterId);
    if (!userNewsletter) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter not found",
      });
    }

    // Get user for ownership check
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    }

    const clampedProgress = Math.max(
      0,
      Math.min(100, args.readProgress ?? 100),
    );

    await upsertNewsletterReadProgress(ctx, {
      userId: user._id,
      userNewsletterId: args.userNewsletterId,
      progress: clampedProgress,
    });

    if (!userNewsletter.isRead) {
      await ctx.db.patch("userNewsletters", args.userNewsletterId, { isRead: true });
    }

    const searchMeta = await getSearchMetaDoc(
      ctx,
      user._id,
      args.userNewsletterId,
    );
    if (!searchMeta) {
      await ctx.db.insert("newsletterSearchMeta", {
        userId: user._id,
        userNewsletterId: args.userNewsletterId,
        subject: userNewsletter.subject,
        senderEmail: userNewsletter.senderEmail,
        senderName: userNewsletter.senderName,
        receivedAt: userNewsletter.receivedAt,
        isHidden: userNewsletter.isHidden,
        isBinned: Boolean(userNewsletter.isBinned),
        isRead: true,
        isLockedByPlan: Boolean(userNewsletter.isLockedByPlan),
      });
    } else if (!searchMeta.isRead) {
      await ctx.db.patch("newsletterSearchMeta", searchMeta._id, { isRead: true });
    }
  },
});

/**
 * Mark newsletter as unread (public mutation)
 * Story 3.4: AC4 - Mark as unread functionality
 */
export const markNewsletterUnread = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const userNewsletter = await ctx.db.get("userNewsletters", args.userNewsletterId);
    if (!userNewsletter) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter not found",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    }

    await ctx.db.patch("userNewsletters", args.userNewsletterId, {
      isRead: false,
      // Keep readProgress for "resume reading" feature
    });

    const searchMeta = await getSearchMetaDoc(
      ctx,
      user._id,
      args.userNewsletterId,
    );
    if (!searchMeta) {
      await ctx.db.insert("newsletterSearchMeta", {
        userId: user._id,
        userNewsletterId: args.userNewsletterId,
        subject: userNewsletter.subject,
        senderEmail: userNewsletter.senderEmail,
        senderName: userNewsletter.senderName,
        receivedAt: userNewsletter.receivedAt,
        isHidden: userNewsletter.isHidden,
        isBinned: Boolean(userNewsletter.isBinned),
        isRead: false,
        isLockedByPlan: Boolean(userNewsletter.isLockedByPlan),
      });
    } else if (searchMeta.isRead) {
      await ctx.db.patch("newsletterSearchMeta", searchMeta._id, { isRead: false });
    }
  },
});

/**
 * Update reading progress (public mutation)
 * Story 3.4: AC1, AC3 - Scroll tracking with auto-mark as read at 100%
 */
export const updateNewsletterReadProgress = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    readProgress: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const userNewsletter = await ctx.db.get("userNewsletters", args.userNewsletterId);
    if (!userNewsletter) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter not found",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    }

    // Clamp progress to 0-100
    const clampedProgress = Math.max(0, Math.min(100, args.readProgress));

    await upsertNewsletterReadProgress(ctx, {
      userId: user._id,
      userNewsletterId: args.userNewsletterId,
      progress: clampedProgress,
    });

    if (clampedProgress === 100 && !userNewsletter.isRead) {
      await ctx.db.patch("userNewsletters", args.userNewsletterId, { isRead: true });

      const searchMeta = await getSearchMetaDoc(
        ctx,
        user._id,
        args.userNewsletterId,
      );
      if (!searchMeta) {
        await ctx.db.insert("newsletterSearchMeta", {
          userId: user._id,
          userNewsletterId: args.userNewsletterId,
          subject: userNewsletter.subject,
          senderEmail: userNewsletter.senderEmail,
          senderName: userNewsletter.senderName,
          receivedAt: userNewsletter.receivedAt,
          isHidden: userNewsletter.isHidden,
          isBinned: Boolean(userNewsletter.isBinned),
          isRead: true,
          isLockedByPlan: Boolean(userNewsletter.isLockedByPlan),
        });
      } else if (!searchMeta.isRead) {
        await ctx.db.patch("newsletterSearchMeta", searchMeta._id, { isRead: true });
      }
    }
  },
});

/**
 * Hide newsletter (public mutation)
 * Story 3.5: AC1 - Hide from list/detail view
 */
export const hideNewsletter = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const userNewsletter = await ctx.db.get("userNewsletters", args.userNewsletterId);
    if (!userNewsletter) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter not found",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    }

    await ctx.db.patch("userNewsletters", args.userNewsletterId, {
      isHidden: true,
    });

    const searchMeta = await getSearchMetaDoc(
      ctx,
      user._id,
      args.userNewsletterId,
    );
    if (!searchMeta) {
      await ctx.db.insert("newsletterSearchMeta", {
        userId: user._id,
        userNewsletterId: args.userNewsletterId,
        subject: userNewsletter.subject,
        senderEmail: userNewsletter.senderEmail,
        senderName: userNewsletter.senderName,
        receivedAt: userNewsletter.receivedAt,
        isHidden: true,
        isBinned: Boolean(userNewsletter.isBinned),
        isRead: userNewsletter.isRead,
        isLockedByPlan: Boolean(userNewsletter.isLockedByPlan),
      });
    } else if (!searchMeta.isHidden) {
      await ctx.db.patch("newsletterSearchMeta", searchMeta._id, { isHidden: true });
    }
  },
});

/**
 * Unhide newsletter (public mutation)
 * Story 3.5: AC4 - Restore from hidden
 */
export const unhideNewsletter = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const userNewsletter = await ctx.db.get("userNewsletters", args.userNewsletterId);
    if (!userNewsletter) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter not found",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    }

    await ctx.db.patch("userNewsletters", args.userNewsletterId, {
      isHidden: false,
    });

    const searchMeta = await getSearchMetaDoc(
      ctx,
      user._id,
      args.userNewsletterId,
    );
    if (!searchMeta) {
      await ctx.db.insert("newsletterSearchMeta", {
        userId: user._id,
        userNewsletterId: args.userNewsletterId,
        subject: userNewsletter.subject,
        senderEmail: userNewsletter.senderEmail,
        senderName: userNewsletter.senderName,
        receivedAt: userNewsletter.receivedAt,
        isHidden: false,
        isBinned: Boolean(userNewsletter.isBinned),
        isRead: userNewsletter.isRead,
        isLockedByPlan: Boolean(userNewsletter.isLockedByPlan),
      });
    } else if (searchMeta.isHidden) {
      await ctx.db.patch("newsletterSearchMeta", searchMeta._id, { isHidden: false });
    }
  },
});

/**
 * Move newsletter to bin (soft delete).
 * Binned newsletters are excluded from regular list queries and can be emptied later.
 */
export const binNewsletter = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const userNewsletter = await ctx.db.get("userNewsletters", args.userNewsletterId);
    if (!userNewsletter) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter not found",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    }

    await ctx.db.patch("userNewsletters", args.userNewsletterId, {
      isBinned: true,
      binnedAt: Date.now(),
    });

    const searchMeta = await getSearchMetaDoc(
      ctx,
      user._id,
      args.userNewsletterId,
    );
    if (!searchMeta) {
      await ctx.db.insert("newsletterSearchMeta", {
        userId: user._id,
        userNewsletterId: args.userNewsletterId,
        subject: userNewsletter.subject,
        senderEmail: userNewsletter.senderEmail,
        senderName: userNewsletter.senderName,
        receivedAt: userNewsletter.receivedAt,
        isHidden: userNewsletter.isHidden,
        isBinned: true,
        isRead: userNewsletter.isRead,
        isLockedByPlan: Boolean(userNewsletter.isLockedByPlan),
      });
    } else if (!searchMeta.isBinned) {
      await ctx.db.patch("newsletterSearchMeta", searchMeta._id, { isBinned: true });
    }
  },
});

/**
 * Set favorite status for a newsletter.
 * Favorites are user-scoped and can coexist with hidden/news read state.
 */
export const setNewsletterFavorite = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    isFavorited: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const userNewsletter = await ctx.db.get("userNewsletters", args.userNewsletterId);
    if (!userNewsletter) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter not found",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    }

    await ctx.db.patch("userNewsletters", args.userNewsletterId, {
      isFavorited: args.isFavorited,
    });
  },
});

/**
 * List favorited newsletters for current user.
 * Returns only non-hidden favorites sorted by newest first.
 */
export const listFavoritedNewsletters = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user) return [];

    const favoritedNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_isFavorited_isHidden_receivedAt", (q) =>
        q.eq("userId", user._id).eq("isFavorited", true).eq("isHidden", false),
      )
      .order("desc")
      .collect();

    const folders = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const hiddenFolderIds = new Set(
      folders.filter((folder) => folder.isHidden).map((folder) => folder._id),
    );
    const visibleFavorites = favoritedNewsletters.filter(
      (newsletter) =>
        !newsletter.isBinned &&
        (!newsletter.folderId || !hiddenFolderIds.has(newsletter.folderId)),
    );

    const contentIds = visibleFavorites
      .filter((n) => !n.isPrivate && n.contentId && !n.summary)
      .map((n) => n.contentId!);

    const uniqueContentIds = [...new Set(contentIds)];
    const contents = await Promise.all(
      uniqueContentIds.map((id) => ctx.db.get("newsletterContent", id)),
    );
    const contentMap = new Map(
      contents
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c]),
    );

    const enrichedNewsletters = visibleFavorites.map((newsletter) => {
      let hasSummary = Boolean(newsletter.summary);

      if (!hasSummary && !newsletter.isPrivate && newsletter.contentId) {
        const content = contentMap.get(newsletter.contentId);
        hasSummary = Boolean(content?.summary);
      }

      return toNewsletterListItem(newsletter, hasSummary);
    });

    return enrichedNewsletters;
  },
});

export const listFavoritedNewslettersHead = query({
  args: {
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: null };

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();
    if (!user) return { page: [], isDone: true, continueCursor: null };

    const hiddenFolderIds = await getHiddenFolderIdSet(ctx, user._id);

    const result = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_isFavorited_isHidden_receivedAt", (q) =>
        q.eq("userId", user._id).eq("isFavorited", true).eq("isHidden", false),
      )
      .order("desc")
      .paginate({ numItems: args.numItems ?? 30, cursor: null });

    const visiblePage = result.page.filter(
      (n) => !n.isBinned && (!n.folderId || !hiddenFolderIds.has(n.folderId)),
    );
    const enriched = await enrichNewsletterListItems(ctx, visiblePage);

    return { ...result, page: enriched };
  },
});

export const listFavoritedNewslettersPageInternal = internalQuery({
  args: {
    userId: v.id("users"),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx, args) => {
    const hiddenFolderIds = await getHiddenFolderIdSet(ctx, args.userId);

    const result = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_isFavorited_isHidden_receivedAt", (q) =>
        q
          .eq("userId", args.userId)
          .eq("isFavorited", true)
          .eq("isHidden", false),
      )
      .order("desc")
      .paginate({ numItems: args.numItems, cursor: args.cursor });

    const visiblePage = result.page.filter(
      (n) => !n.isBinned && (!n.folderId || !hiddenFolderIds.has(n.folderId)),
    );
    const enriched = await enrichNewsletterListItems(ctx, visiblePage);

    return { ...result, page: enriched };
  },
});

export const listFavoritedNewslettersPage = action({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx, args): Promise<NewsletterListPageResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const user = await ctx.runQuery(internal._internal.users.findByAuthId, {
      authId: identity.subject,
    });
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    return await ctx.runQuery(
      internal.newsletters.listFavoritedNewslettersPageInternal,
      {
        userId: user._id,
        cursor: args.cursor,
        numItems: args.numItems,
      },
    );
  },
});

/**
 * List hidden newsletters for current user
 * Story 3.5: AC3 - View hidden newsletters
 * Story 5.2: Task 1.1 - Added hasSummary field for summary indicator
 * Story 9.10: Added source field for unified folder view display
 */
export const listHiddenNewsletters = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user) return [];

    // Efficient: query hidden newsletters directly via compound index.
    const hiddenNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_isHidden_receivedAt", (q) =>
        q.eq("userId", user._id).eq("isHidden", true),
      )
      .order("desc")
      .collect();

    // Story 5.2: Derive hasSummary for each newsletter
    // Code review fix: Batch-fetch contentIds to avoid N+1 queries
    const visibleHiddenNewsletters = hiddenNewsletters.filter(
      (newsletter) => !newsletter.isBinned,
    );

    const contentIds = visibleHiddenNewsletters
      .filter((n) => !n.isPrivate && n.contentId && !n.summary)
      .map((n) => n.contentId!);

    const uniqueContentIds = [...new Set(contentIds)];
    const contents = await Promise.all(
      uniqueContentIds.map((id) => ctx.db.get("newsletterContent", id)),
    );
    const contentMap = new Map(
      contents
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c]),
    );

    // Privacy pattern: check personal summary first, then shared if public (O(1) lookup)
    // Story 9.10: Include source field for unified folder view display
    const enrichedNewsletters = visibleHiddenNewsletters.map((newsletter) => {
      let hasSummary = Boolean(newsletter.summary);

      if (!hasSummary && !newsletter.isPrivate && newsletter.contentId) {
        const content = contentMap.get(newsletter.contentId);
        hasSummary = Boolean(content?.summary);
      }

      return toNewsletterListItem(newsletter, hasSummary);
    });

    return enrichedNewsletters;
  },
});

export const listHiddenNewslettersHead = query({
  args: {
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: null };

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();
    if (!user) return { page: [], isDone: true, continueCursor: null };

    const result = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_isHidden_receivedAt", (q) =>
        q.eq("userId", user._id).eq("isHidden", true),
      )
      .order("desc")
      .paginate({ numItems: args.numItems ?? 30, cursor: null });

    const visiblePage = result.page.filter(
      (newsletter) => !newsletter.isBinned,
    );
    const enriched = await enrichNewsletterListItems(ctx, visiblePage);
    return { ...result, page: enriched };
  },
});

export const listHiddenNewslettersPageInternal = internalQuery({
  args: {
    userId: v.id("users"),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_isHidden_receivedAt", (q) =>
        q.eq("userId", args.userId).eq("isHidden", true),
      )
      .order("desc")
      .paginate({ numItems: args.numItems, cursor: args.cursor });

    const visiblePage = result.page.filter(
      (newsletter) => !newsletter.isBinned,
    );
    const enriched = await enrichNewsletterListItems(ctx, visiblePage);
    return { ...result, page: enriched };
  },
});

export const listHiddenNewslettersPage = action({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx, args): Promise<NewsletterListPageResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const user = await ctx.runQuery(internal._internal.users.findByAuthId, {
      authId: identity.subject,
    });
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    return await ctx.runQuery(
      internal.newsletters.listHiddenNewslettersPageInternal,
      {
        userId: user._id,
        cursor: args.cursor,
        numItems: args.numItems,
      },
    );
  },
});

export const listBinnedNewslettersHead = query({
  args: {
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: null };

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();
    if (!user) return { page: [], isDone: true, continueCursor: null };

    const result = await (ctx.db.query("userNewsletters") as any)
      .withIndex("by_userId_isBinned_binnedAt", (q: any) =>
        q.eq("userId", user._id).eq("isBinned", true),
      )
      .order("desc")
      .paginate({ numItems: args.numItems ?? 30, cursor: null });

    const enriched = await enrichNewsletterListItems(
      ctx,
      result.page as Array<Doc<"userNewsletters">>,
    );
    return { ...result, page: enriched };
  },
});

export const listBinnedNewslettersPageInternal = internalQuery({
  args: {
    userId: v.id("users"),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await (ctx.db.query("userNewsletters") as any)
      .withIndex("by_userId_isBinned_binnedAt", (q: any) =>
        q.eq("userId", args.userId).eq("isBinned", true),
      )
      .order("desc")
      .paginate({ numItems: args.numItems, cursor: args.cursor });

    const enriched = await enrichNewsletterListItems(
      ctx,
      result.page as Array<Doc<"userNewsletters">>,
    );
    return { ...result, page: enriched };
  },
});

export const listBinnedNewslettersPage = action({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx, args): Promise<NewsletterListPageResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const user = await ctx.runQuery(internal._internal.users.findByAuthId, {
      authId: identity.subject,
    });
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    return await ctx.runQuery(
      (internal as any).newsletters.listBinnedNewslettersPageInternal,
      {
        userId: user._id,
        cursor: args.cursor,
        numItems: args.numItems,
      },
    );
  },
});

// ============================================================
// Story 9.4: Folder-Centric Navigation Queries
// ============================================================

/**
 * Get count of hidden newsletters
 * Story 9.4: AC3 - Hidden section shows count of hidden newsletters
 *
 * Returns the count of all newsletters with isHidden === true for the current user.
 * Used by FolderSidebar to show hidden newsletter count in the "Hidden" section.
 *
 * Note: This counts hidden NEWSLETTERS, not hidden folders.
 * Hidden folders are excluded from the sidebar entirely.
 */
export const getHiddenNewsletterCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user) return 0;

    const hiddenNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_isHidden_receivedAt", (q) =>
        q.eq("userId", user._id).eq("isHidden", true),
      )
      .collect();

    return hiddenNewsletters.filter((newsletter) => !newsletter.isBinned)
      .length;
  },
});

export const getBinnedNewsletterCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user) return 0;

    const binnedNewsletters = await (ctx.db.query("userNewsletters") as any)
      .withIndex("by_userId_isBinned_binnedAt", (q: any) =>
        q.eq("userId", user._id).eq("isBinned", true),
      )
      .collect();

    return binnedNewsletters.length;
  },
});

/**
 * Get count of favorited newsletters.
 *
 * Used by navigation UI (sidebar) which only needs a count, not the full list.
 * Returning a number here avoids sending potentially large arrays over the wire.
 */
export const getFavoritedNewsletterCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user) return 0;

    const favoritedNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_isFavorited_isHidden_receivedAt", (q) =>
        q.eq("userId", user._id).eq("isFavorited", true).eq("isHidden", false),
      )
      .collect();

    const folders = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const hiddenFolderIds = new Set(
      folders.filter((folder) => folder.isHidden).map((folder) => folder._id),
    );

    const visibleFavorites = favoritedNewsletters.filter(
      (newsletter) =>
        !newsletter.isBinned &&
        (!newsletter.folderId || !hiddenFolderIds.has(newsletter.folderId)),
    );

    return visibleFavorites.length;
  },
});

async function backfillNewsletterSearchMetaRecentImpl(
  ctx: {
    db: {
      query: (table: "userNewsletters" | "newsletterSearchMeta") => any;
      insert: (table: "newsletterSearchMeta", value: any) => Promise<any>;
      patch: (id: any, value: any) => Promise<void>;
    };
  },
  args: { userId: Id<"users">; limit: number },
): Promise<{ inserted: number; updated: number }> {
  const limit = Math.max(1, Math.min(args.limit, 1000));

  const newsletters = (await ctx.db
    .query("userNewsletters")
    .withIndex("by_userId_receivedAt", (q: any) => q.eq("userId", args.userId))
    .order("desc")
    .take(limit)) as Array<Doc<"userNewsletters">>;

  const existingMeta = (await ctx.db
    .query("newsletterSearchMeta")
    .withIndex("by_userId_receivedAt", (q: any) => q.eq("userId", args.userId))
    .order("desc")
    .take(limit)) as Array<Doc<"newsletterSearchMeta">>;

  const metaByNewsletterId = new Map(
    existingMeta.map((doc: Doc<"newsletterSearchMeta">) => [
      doc.userNewsletterId,
      doc,
    ]),
  );

  let inserted = 0;
  let updated = 0;

  for (const newsletter of newsletters) {
    const current = metaByNewsletterId.get(newsletter._id);
    const desired = {
      subject: newsletter.subject,
      senderEmail: newsletter.senderEmail,
      senderName: newsletter.senderName,
      receivedAt: newsletter.receivedAt,
      isHidden: newsletter.isHidden,
      isBinned: Boolean(newsletter.isBinned),
      isRead: newsletter.isRead,
      isLockedByPlan: Boolean(newsletter.isLockedByPlan),
    };

    if (!current) {
      await ctx.db.insert("newsletterSearchMeta", {
        userId: args.userId,
        userNewsletterId: newsletter._id,
        ...desired,
      });
      inserted++;
      continue;
    }

    const patch: any = {};
    if (current.subject !== desired.subject) patch.subject = desired.subject;
    if (current.senderEmail !== desired.senderEmail)
      patch.senderEmail = desired.senderEmail;
    if (current.senderName !== desired.senderName)
      patch.senderName = desired.senderName;
    if (current.receivedAt !== desired.receivedAt)
      patch.receivedAt = desired.receivedAt;
    if (current.isHidden !== desired.isHidden)
      patch.isHidden = desired.isHidden;
    if (Boolean(current.isBinned) !== desired.isBinned)
      patch.isBinned = desired.isBinned;
    if (current.isRead !== desired.isRead) patch.isRead = desired.isRead;
    if (current.isLockedByPlan !== desired.isLockedByPlan)
      patch.isLockedByPlan = desired.isLockedByPlan;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch("newsletterSearchMeta", current._id, patch);
      updated++;
    }
  }

  return { inserted, updated };
}

export const backfillNewsletterSearchMetaRecentForUser = internalMutation({
  args: {
    userId: v.id("users"),
    limit: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ inserted: number; updated: number }> => {
    return await backfillNewsletterSearchMetaRecentImpl(ctx, {
      userId: args.userId,
      limit: args.limit,
    });
  },
});

export const backfillNewsletterSearchMetaRecent = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ inserted: number; updated: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    const limit = Math.min(args.limit ?? 500, 1000);
    return await backfillNewsletterSearchMetaRecentImpl(ctx, {
      userId: user._id,
      limit,
    });
  },
});

type NewsletterSearchMetaResult = {
  userNewsletterId: Id<"userNewsletters">;
  subject: string;
  senderEmail: string;
  senderName?: string;
  receivedAt: number;
  isHidden: boolean;
  isRead: boolean;
};

/**
 * Search the current user's newsletters by subject + sender name/email.
 *
 * Note: this is designed to be called non-reactively from the client
 * (via `useConvex().query(...)` inside TanStack Query) to avoid creating
 * Convex subscriptions on each keystroke.
 */
export const searchUserNewslettersMeta = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<NewsletterSearchMetaResult[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    const q = args.query.trim().toLowerCase();
    if (q.length < 2) return [];

    const limit = Math.min(args.limit ?? 20, 50);

    const recent = await ctx.db
      .query("newsletterSearchMeta")
      .withIndex("by_userId_receivedAt", (q2: any) => q2.eq("userId", user._id))
      .order("desc")
      .take(500);

    const matches = recent.filter((doc: Doc<"newsletterSearchMeta">) => {
      if (doc.isBinned) return false;
      if (doc.subject.toLowerCase().includes(q)) return true;
      if (doc.senderEmail.toLowerCase().includes(q)) return true;
      if (doc.senderName && doc.senderName.toLowerCase().includes(q))
        return true;
      return false;
    });

    return matches.slice(0, limit).map((doc) => ({
      userNewsletterId: doc.userNewsletterId,
      subject: doc.subject,
      senderEmail: doc.senderEmail,
      senderName: doc.senderName,
      receivedAt: doc.receivedAt,
      isHidden: doc.isHidden,
      isRead: doc.isRead,
    }));
  },
});

// ============================================================
// Story 6.4: Empty State Detection
// ============================================================

/**
 * Check if user has any newsletters
 * Story 6.4 Task 4.1 - For empty state detection
 *
 * Returns true if user has at least one newsletter in userNewsletters.
 * Used to determine if we should show "Discover" CTA for new users.
 */
export const hasAnyNewsletters = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();
    if (!user) return false;

    const firstNewsletter = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    return firstNewsletter !== null;
  },
});

// ============================================================
// Story 9.10: Delete Newsletter with Community Import Support
// ============================================================

async function deleteUserNewsletterRecord(
  ctx: any,
  userId: Id<"users">,
  userNewsletter: Doc<"userNewsletters">,
): Promise<void> {
  if (userNewsletter.source === "community" && userNewsletter.contentId) {
    const content = await ctx.db.get("newsletterContent", userNewsletter.contentId);
    if (content) {
      const newImportCount = Math.max(0, (content.importCount ?? 1) - 1);
      await ctx.db.patch("newsletterContent", userNewsletter.contentId, {
        importCount: newImportCount,
      });
    }
  }

  const searchMeta = await getSearchMetaDoc(ctx, userId, userNewsletter._id);
  if (searchMeta) {
    await ctx.db.delete("newsletterSearchMeta", searchMeta._id);
  }

  const counters = await ctx.db
    .query("userUsageCounters")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();

  if (counters) {
    const wasLocked = Boolean(userNewsletter.isLockedByPlan);
    await ctx.db.patch("userUsageCounters", counters._id, {
      totalStored: Math.max(0, counters.totalStored - 1),
      unlockedStored: Math.max(
        0,
        counters.unlockedStored - (wasLocked ? 0 : 1),
      ),
      lockedStored: Math.max(0, counters.lockedStored - (wasLocked ? 1 : 0)),
      updatedAt: Date.now(),
    });
  }

  await ctx.db.delete("userNewsletters", userNewsletter._id);
}

/**
 * Delete a user newsletter from their collection
 * Story 9.10 Task 4: Handle community import decrement
 *
 * For community imports (source === "community"):
 * - Decrements importCount on newsletterContent
 * - Does NOT delete the newsletterContent record (other users may have it)
 *
 * For private sources (email, gmail, manual):
 * - Simply removes the userNewsletter record
 * - R2 content cleanup is handled separately (not in this mutation)
 */
export const deleteUserNewsletter = mutation({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    const userNewsletter = await ctx.db.get("userNewsletters", args.userNewsletterId);

    if (!userNewsletter) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter not found",
      });
    }

    // Verify ownership
    if (userNewsletter.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Not your newsletter",
      });
    }

    await deleteUserNewsletterRecord(ctx, user._id, userNewsletter);

    return { deleted: true };
  },
});

export const emptyBinBatchDelete = internalMutation({
  args: {
    userId: v.id("users"),
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    deletedCount: number;
    continueCursor: string | null;
    isDone: boolean;
  }> => {
    const pageSize = Math.max(1, Math.min(args.numItems ?? 100, 200));
    const result = await (ctx.db.query("userNewsletters") as any)
      .withIndex("by_userId_isBinned_binnedAt", (q: any) =>
        q.eq("userId", args.userId).eq("isBinned", true),
      )
      .order("asc")
      .paginate({ numItems: pageSize, cursor: args.cursor });

    let deletedCount = 0;
    for (const newsletter of result.page as Array<Doc<"userNewsletters">>) {
      await deleteUserNewsletterRecord(ctx, args.userId, newsletter);
      deletedCount++;
    }

    return {
      deletedCount,
      continueCursor: result.continueCursor ?? null,
      isDone: result.isDone ?? true,
    };
  },
});

export const emptyBin = action({
  args: {},
  handler: async (ctx): Promise<{ deletedCount: number }> => {
    type EmptyBinBatchDeleteResult = {
      deletedCount: number;
      continueCursor: string | null;
      isDone: boolean;
    };

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const user = await ctx.runQuery(internal._internal.users.findByAuthId, {
      authId: identity.subject,
    });
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    let deletedCount = 0;
    let cursor: string | null = null;

    while (true) {
      const batch: EmptyBinBatchDeleteResult = await ctx.runMutation(
        (internal as any).newsletters.emptyBinBatchDelete,
        {
          userId: user._id,
          cursor,
          numItems: 100,
        },
      );
      deletedCount += batch.deletedCount;

      if (batch.isDone || batch.continueCursor === null) {
        break;
      }
      cursor = batch.continueCursor;
    }

    return { deletedCount };
  },
});

export const cleanupExpiredBinnedNewsletters = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ deletedCount: number }> => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const expiredBinnedNewsletters = await (
      ctx.db.query("userNewsletters") as any
    )
      .withIndex("by_isBinned_binnedAt", (q: any) =>
        q.eq("isBinned", true).lte("binnedAt", cutoff),
      )
      .order("asc")
      .take(200);

    let deletedCount = 0;
    for (const newsletter of expiredBinnedNewsletters as Array<
      Doc<"userNewsletters">
    >) {
      await deleteUserNewsletterRecord(ctx, newsletter.userId, newsletter);
      deletedCount++;
    }

    return { deletedCount };
  },
});
