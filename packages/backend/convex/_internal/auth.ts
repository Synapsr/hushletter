import type { QueryCtx, MutationCtx } from "../_generated/server"
import { ConvexError } from "convex/values"
import { authComponent } from "../auth"

/**
 * Require admin role for the current user.
 * Use at the start of any admin-only query/mutation.
 *
 * Story 7.1: Task 1.2 - Admin authorization helper
 *
 * @throws ConvexError with code "UNAUTHORIZED" if not authenticated
 * @throws ConvexError with code "FORBIDDEN" if authenticated but not admin
 * @returns The authenticated admin user record from the users table
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  // Get authenticated user from Better Auth
  let authUser
  try {
    authUser = await authComponent.getAuthUser(ctx)
  } catch {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    })
  }

  if (!authUser) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    })
  }

  // Find the app user record linked to the auth user
  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
    .first()

  if (!user) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "User not found",
    })
  }

  // Check if user has admin role
  if (!user.isAdmin) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Admin access required",
    })
  }

  return user
}
