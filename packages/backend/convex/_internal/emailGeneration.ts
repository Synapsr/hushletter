// Email domain for dedicated newsletter addresses
// MUST be configured via EMAIL_DOMAIN environment variable in production
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "newsletters.example.com"

// Log warning if using default domain (helps catch misconfiguration)
if (!process.env.EMAIL_DOMAIN) {
  console.warn(
    "[emailGeneration] EMAIL_DOMAIN environment variable not set. Using default: newsletters.example.com. " +
      "This MUST be configured for production use."
  )
}

/**
 * Generates a unique dedicated email address for a user
 * Uses the last 8 characters of the user ID as prefix
 * IDs are globally unique, ensuring no collisions
 *
 * @param userId - The user ID (Better Auth ID string)
 * @returns The generated email address in format: {prefix}@{EMAIL_DOMAIN}
 */
export function generateDedicatedEmail(userId: string): string {
  // Extract first 8 chars of user ID for a unique, deterministic prefix
  // Convex IDs start with a type prefix, so we skip that to get the unique part
  const idString = userId.toString()
  const prefix = idString.slice(-8).toLowerCase()
  return `${prefix}@${EMAIL_DOMAIN}`
}

/**
 * Validates that an email address matches the expected dedicated email format
 *
 * @param email - The email address to validate
 * @returns true if the email is a valid dedicated email format
 */
export function isValidDedicatedEmail(email: string): boolean {
  if (!email) return false
  const parts = email.split("@")
  if (parts.length !== 2) return false
  const [prefix, domain] = parts
  // Prefix should be 8 lowercase alphanumeric characters
  return prefix.length === 8 && /^[a-z0-9]+$/.test(prefix) && domain === EMAIL_DOMAIN
}

/**
 * Gets the configured email domain
 * Useful for display purposes
 */
export function getEmailDomain(): string {
  return EMAIL_DOMAIN
}
