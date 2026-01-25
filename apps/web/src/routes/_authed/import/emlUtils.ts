/**
 * EML Import Utilities
 * Story 8.2: Shared utilities for .eml file import operations
 */

/**
 * Read File as ArrayBuffer for EML parser
 */
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Map EML parser error codes to user-friendly messages
 */
export function getParserErrorMessage(errorCode: string): string {
  const errorMap: Record<string, string> = {
    INVALID_FORMAT: "This file doesn't appear to be a valid email file",
    MISSING_REQUIRED_FIELD: "Email file is missing required information (sender/date)",
    FILE_TOO_LARGE: "File is too large. Maximum size is 10MB",
    DATE_PARSE_ERROR: "Could not read the email date",
    TOO_MANY_ATTACHMENTS: "Email has too many attachments",
    CONTENT_ERROR: "Failed to extract email content",
  }
  return errorMap[errorCode] || "Failed to parse email file"
}
