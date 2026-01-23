/**
 * Extract a human-readable error message from various error types.
 * Handles Better Auth errors, standard Error objects, and unknown types.
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (error && typeof error === "object") {
    // Handle Better Auth error structure
    if ("message" in error && typeof error.message === "string") {
      return error.message
    }
    // Handle nested error objects
    if ("error" in error && typeof error.error === "object" && error.error) {
      return getErrorMessage(error.error)
    }
  }
  return "An unexpected error occurred"
}

/**
 * Extract username from email address.
 * Handles edge cases like multiple @ symbols.
 */
export function extractNameFromEmail(email: string): string {
  if (!email || typeof email !== "string") return "User"

  // Find the first @ symbol and take everything before it
  const atIndex = email.indexOf("@")
  if (atIndex <= 0) return "User"

  const prefix = email.substring(0, atIndex).trim()

  // Return "User" if prefix is empty or only whitespace
  return prefix || "User"
}
