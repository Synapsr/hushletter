/**
 * Environment variables for the email worker
 */
export interface Env {
  // Production
  CONVEX_URL: string
  INTERNAL_API_KEY: string
  // Development (optional - for -dev@ addresses)
  CONVEX_URL_DEV?: string
  INTERNAL_API_KEY_DEV?: string
  // Rate limiting for import (optional - Story 8.3)
  IMPORT_RATE_LIMIT?: KVNamespace
}

/**
 * Email data payload sent to Convex (full payload including parsed content)
 */
export interface EmailPayload {
  to: string
  from: string
  subject: string
  senderName?: string
  receivedAt: number
  /** HTML content (sanitized) - preferred if available */
  htmlContent?: string
  /** Plain text content - fallback if no HTML */
  textContent?: string
}

/**
 * Response from Convex email ingestion endpoint
 */
export interface ConvexEmailResponse {
  success: boolean
  userId?: string
  newsletterId?: string
  error?: string
}

// ============================================================
// Story 8.3: Import-specific types
// ============================================================

/**
 * Import-specific payload for Convex
 * Used when forwarding emails to import@hushletter.com
 */
export interface ImportEmailPayload {
  userId: string
  forwardingUserEmail: string
  originalFrom: string
  originalFromName?: string
  originalSubject: string
  originalDate: number
  htmlContent?: string
  textContent?: string
}

/**
 * Response from Convex import endpoint
 */
export interface ConvexImportResponse {
  success: boolean
  userNewsletterId?: string
  senderId?: string
  error?: string
}
