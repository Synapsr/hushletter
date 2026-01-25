/**
 * EML Parser Types
 *
 * Types for parsing .eml files for manual newsletter import.
 * Used by Story 8.2 (drag-drop UI), Story 8.3 (forward-to-import), and Story 8.4 (duplicate detection).
 */

/**
 * Parsed EML file data structure
 */
export interface ParsedEml {
  /** Message-ID header for duplicate detection */
  messageId: string | null
  /** Email subject line */
  subject: string
  /** Sender email address */
  senderEmail: string
  /** Sender display name (if available) */
  senderName: string | null
  /** Original received date as Unix timestamp (milliseconds) */
  receivedAt: number
  /** Sanitized HTML body content */
  htmlContent: string | null
  /** Plain text body content (fallback) */
  textContent: string | null
  /** Inline images with resolved CID references */
  inlineImages: InlineImage[]
  /** Non-inline file attachments */
  attachments: EmlAttachment[]
}

/**
 * Inline image extracted from email with CID reference
 */
export interface InlineImage {
  /** Content-ID reference (without angle brackets) */
  contentId: string
  /** MIME type (e.g., image/png, image/jpeg) */
  mimeType: string
  /** Base64 encoded image data */
  data: string
}

/**
 * File attachment from email
 */
export interface EmlAttachment {
  /** Original filename */
  filename: string
  /** MIME type */
  mimeType: string
  /** File size in bytes */
  size: number
  /** Raw attachment data */
  data: Uint8Array
}

/**
 * Structured error codes for EML parsing failures
 */
export type EmlParseErrorCode =
  | "INVALID_FORMAT"
  | "MISSING_REQUIRED_FIELD"
  | "DATE_PARSE_ERROR"
  | "CONTENT_ERROR"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_ATTACHMENTS"

/**
 * Structured error for EML parsing failures
 */
export interface EmlParseError {
  /** Error code for programmatic handling */
  code: EmlParseErrorCode
  /** Human-readable error message */
  message: string
  /** Field that caused the error (if applicable) */
  field?: string
}

/**
 * Result type for EML parsing - success or failure with structured error
 */
export type EmlParseResult =
  | { success: true; data: ParsedEml }
  | { success: false; error: EmlParseError }

/**
 * Options for parsing EML files
 */
export interface EmlParseOptions {
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSize?: number
  /** Maximum total attachment size in bytes (default: 50MB) */
  maxAttachmentSize?: number
  /** Maximum number of inline images to process (default: 10) */
  maxInlineImages?: number
}

/**
 * Default parsing limits
 */
export const EML_PARSE_DEFAULTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_ATTACHMENT_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_INLINE_IMAGES: 10,
} as const
