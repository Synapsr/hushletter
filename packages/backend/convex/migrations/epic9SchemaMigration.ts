import { internalAction, internalMutation, internalQuery } from "../_generated/server"
import { v } from "convex/values"
import { internal } from "../_generated/api"
import type { Id, Doc } from "../_generated/dataModel"

/**
 * Epic 9 Schema Migration - Privacy-First & Folder-Centric Architecture
 * Story 9.1: Tasks 2, 3 - Data Migration Script
 *
 * This migration:
 * 1. Adds isHidden and updatedAt to existing folders
 * 2. Creates folders for each unique sender-user combination
 * 3. Links userSenderSettings to created folders
 * 4. Links userNewsletters to folders via senderId → userSenderSettings → folderId
 * 5. Sets source field on userNewsletters (default "email", detect "gmail" where possible)
 *
 * IMPORTANT: This migration is IDEMPOTENT - safe to run multiple times.
 * It skips records that already have the required fields populated.
 */

// =============================================================================
// Task 2.1: Internal action to orchestrate the migration
// =============================================================================

export const runMigration = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean
    stats: {
      usersProcessed: number
      foldersCreated: number
      foldersUpdated: number
      senderSettingsUpdated: number
      newslettersUpdated: number
      errors: string[]
    }
  }> => {
    const stats = {
      usersProcessed: 0,
      foldersCreated: 0,
      foldersUpdated: 0,
      senderSettingsUpdated: 0,
      newslettersUpdated: 0,
      errors: [] as string[],
    }

    try {
      // Step 1: Update existing folders with new fields (isHidden, updatedAt)
      const folderUpdateResult = await ctx.runMutation(
        internal.migrations.epic9SchemaMigration.updateExistingFolders
      )
      stats.foldersUpdated = folderUpdateResult.updated

      // Step 2: Get all users
      const users = await ctx.runQuery(
        internal.migrations.epic9SchemaMigration.getAllUsers
      )

      // Step 3: Process each user
      for (const user of users) {
        try {
          const userResult = await ctx.runMutation(
            internal.migrations.epic9SchemaMigration.migrateUserData,
            { userId: user._id }
          )
          stats.usersProcessed++
          stats.foldersCreated += userResult.foldersCreated
          stats.senderSettingsUpdated += userResult.senderSettingsUpdated
          stats.newslettersUpdated += userResult.newslettersUpdated
        } catch (error) {
          const errorMsg = `Failed to migrate user ${user._id}: ${error instanceof Error ? error.message : String(error)}`
          stats.errors.push(errorMsg)
          console.error(errorMsg)
        }
      }

      return { success: stats.errors.length === 0, stats }
    } catch (error) {
      stats.errors.push(
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`
      )
      return { success: false, stats }
    }
  },
})

// =============================================================================
// Task 2.7: Update existing folders with isHidden=false, updatedAt=now
// =============================================================================

export const updateExistingFolders = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ updated: number }> => {
    const folders = await ctx.db.query("folders").collect()
    let updated = 0

    for (const folder of folders) {
      // Only update if fields are missing (idempotent)
      // Check using 'in' operator since we're looking for field existence
      const folderRecord = folder as Record<string, unknown>
      if (!("isHidden" in folderRecord) || !("updatedAt" in folderRecord)) {
        await ctx.db.patch("folders", folder._id, {
          isHidden: false,
          updatedAt: Date.now(),
        })
        updated++
      }
    }

    return { updated }
  },
})

// =============================================================================
// Helper query to get all users
// =============================================================================

export const getAllUsers = internalQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"users">[]> => {
    return await ctx.db.query("users").collect()
  },
})

// =============================================================================
// Task 2.2 - 2.6, Task 3: Migrate data for a single user
// =============================================================================

export const migrateUserData = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    foldersCreated: number
    senderSettingsUpdated: number
    newslettersUpdated: number
  }> => {
    const result = {
      foldersCreated: 0,
      senderSettingsUpdated: 0,
      newslettersUpdated: 0,
    }

    const userId = args.userId

    // Get all user's sender settings
    const allSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()

    // Get all user's existing folders
    const existingFolders = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()

    // Build folder name lookup for duplicate detection
    const folderNameSet = new Set(existingFolders.map((f) => f.name.toLowerCase()))

    // Map senderId -> folderId (for newsletter updates)
    const senderToFolderMap = new Map<string, Id<"folders">>()

    // First, populate map with existing folder assignments
    for (const setting of allSettings) {
      if (setting.folderId) {
        senderToFolderMap.set(setting.senderId, setting.folderId)
      }
    }

    // Task 2.2 - 2.3: Create folders for senders without folders
    for (const setting of allSettings) {
      // Skip if already has folder (idempotent)
      if (setting.folderId) {
        continue
      }

      // Get sender info for folder name
      const sender = await ctx.db.get("senders", setting.senderId)
      if (!sender) {
        // Task 3.1: Handle missing sender (shouldn't happen, but be defensive)
        continue
      }

      // Task 3.1: Use email address if no name
      let baseFolderName = sender.name || sender.email

      // Task 3.2: Handle duplicate folder names
      let finalFolderName = baseFolderName
      let counter = 1
      while (folderNameSet.has(finalFolderName.toLowerCase())) {
        counter++
        finalFolderName = `${baseFolderName} ${counter}`
      }

      // Task 2.6, 2.7: Create folder with isHidden=false, updatedAt=now
      const now = Date.now()
      const folderId = await ctx.db.insert("folders", {
        userId,
        name: finalFolderName,
        isHidden: false,
        createdAt: now,
        updatedAt: now,
      })

      // Track the new folder name to prevent duplicates within this batch
      folderNameSet.add(finalFolderName.toLowerCase())
      senderToFolderMap.set(setting.senderId, folderId)
      result.foldersCreated++

      // Task 2.3: Update setting with folderId
      await ctx.db.patch("userSenderSettings", setting._id, { folderId })
      result.senderSettingsUpdated++
    }

    // Task 2.4, 2.5: Update userNewsletters with folderId and source
    const newsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()

    for (const newsletter of newsletters) {
      const newsletterRecord = newsletter as Record<string, unknown>

      // Check if newsletter needs updating (idempotent)
      const needsFolderId = !("folderId" in newsletterRecord) || !newsletterRecord.folderId
      const needsSource = !("source" in newsletterRecord) || !newsletterRecord.source

      if (!needsFolderId && !needsSource) {
        continue
      }

      const updates: {
        folderId?: Id<"folders">
        source?: "email" | "gmail" | "manual" | "community"
      } = {}

      // Task 2.4: Get folderId from sender mapping
      if (needsFolderId) {
        let folderId = senderToFolderMap.get(newsletter.senderId)

        // Task 3.3: Handle newsletters without matching userSenderSettings
        if (!folderId) {
          // Need to create settings record first, then folder
          const sender = await ctx.db.get("senders", newsletter.senderId)
          if (sender) {
            // Create folder for this sender
            let baseFolderName = sender.name || sender.email
            let finalFolderName = baseFolderName
            let counter = 1
            while (folderNameSet.has(finalFolderName.toLowerCase())) {
              counter++
              finalFolderName = `${baseFolderName} ${counter}`
            }

            const now = Date.now()
            folderId = await ctx.db.insert("folders", {
              userId,
              name: finalFolderName,
              isHidden: false,
              createdAt: now,
              updatedAt: now,
            })
            folderNameSet.add(finalFolderName.toLowerCase())
            senderToFolderMap.set(newsletter.senderId, folderId)
            result.foldersCreated++

            // Create userSenderSettings record
            await ctx.db.insert("userSenderSettings", {
              userId,
              senderId: newsletter.senderId,
              isPrivate: newsletter.isPrivate,
              folderId,
            })
            result.senderSettingsUpdated++
          }
        }

        if (folderId) {
          updates.folderId = folderId
        }
      }

      // Task 2.5: Set source field
      // Default to "email" for all existing records - we cannot reliably distinguish
      // Gmail-imported newsletters from dedicated email at migration time.
      // Future newsletters will have source set by the ingestion pipeline.
      if (needsSource) {
        updates.source = "email"
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch("userNewsletters", newsletter._id, updates)
        result.newslettersUpdated++
      }
    }

    return result
  },
})

// =============================================================================
// Task 3.4: Idempotent check - verify migration state
// =============================================================================

export const checkMigrationStatus = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    isComplete: boolean
    stats: {
      totalFolders: number
      foldersNeedingUpdate: number
      totalSenderSettings: number
      settingsWithoutFolder: number
      totalNewsletters: number
      newslettersWithoutFolder: number
      newslettersWithoutSource: number
    }
  }> => {
    const stats = await ctx.runMutation(
      internal.migrations.epic9SchemaMigration.getMigrationStats
    )

    const isComplete =
      stats.foldersNeedingUpdate === 0 &&
      stats.settingsWithoutFolder === 0 &&
      stats.newslettersWithoutFolder === 0 &&
      stats.newslettersWithoutSource === 0

    return { isComplete, stats }
  },
})

export const getMigrationStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const folders = await ctx.db.query("folders").collect()
    const senderSettings = await ctx.db.query("userSenderSettings").collect()
    const newsletters = await ctx.db.query("userNewsletters").collect()

    // Count folders needing isHidden/updatedAt
    let foldersNeedingUpdate = 0
    for (const folder of folders) {
      const folderRecord = folder as Record<string, unknown>
      if (!("isHidden" in folderRecord) || !("updatedAt" in folderRecord)) {
        foldersNeedingUpdate++
      }
    }

    // Count settings without folderId
    const settingsWithoutFolder = senderSettings.filter((s) => !s.folderId).length

    // Count newsletters without folderId or source
    let newslettersWithoutFolder = 0
    let newslettersWithoutSource = 0
    for (const newsletter of newsletters) {
      const newsletterRecord = newsletter as Record<string, unknown>
      if (!("folderId" in newsletterRecord) || !newsletterRecord.folderId) {
        newslettersWithoutFolder++
      }
      if (!("source" in newsletterRecord) || !newsletterRecord.source) {
        newslettersWithoutSource++
      }
    }

    return {
      totalFolders: folders.length,
      foldersNeedingUpdate,
      totalSenderSettings: senderSettings.length,
      settingsWithoutFolder,
      totalNewsletters: newsletters.length,
      newslettersWithoutFolder,
      newslettersWithoutSource,
    }
  },
})
