import type { EmailPayload, ConvexEmailResponse } from "./types"

/**
 * Configuration for Convex connection
 */
export interface ConvexConfig {
  url: string
  apiKey: string
}

/**
 * Sends email data to Convex for processing
 * Uses internal API key authentication
 */
export async function callConvex(
  config: ConvexConfig,
  payload: EmailPayload
): Promise<ConvexEmailResponse> {
  const url = `${config.url}/api/email/ingest`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-API-Key": config.apiKey,
    },
    body: JSON.stringify({
      to: payload.to,
      from: payload.from,
      subject: payload.subject,
      senderName: payload.senderName,
      receivedAt: payload.receivedAt,
      htmlContent: payload.htmlContent,
      textContent: payload.textContent,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as {
      error?: string
      code?: string
      details?: string
    }
    const errorParts = [
      errorData.error || `HTTP ${response.status}`,
      errorData.code && `[${errorData.code}]`,
      errorData.details,
    ].filter(Boolean)

    return {
      success: false,
      error: errorParts.join(" - "),
    }
  }

  return (await response.json()) as ConvexEmailResponse
}

/**
 * Extracts sender name from email header if available
 * Handles formats like: "John Doe <john@example.com>" or just "john@example.com"
 */
export function extractSenderName(fromHeader: string): string | undefined {
  // Match pattern: "Name <email>" or 'Name <email>'
  const match = fromHeader.match(/^["']?([^"'<]+)["']?\s*<[^>]+>$/)
  if (match && match[1]) {
    return match[1].trim()
  }
  return undefined
}
