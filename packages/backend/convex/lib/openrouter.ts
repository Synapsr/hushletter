/**
 * OpenRouter API client for AI completions
 * Story 5.1: Task 2 - OpenRouter client setup
 *
 * Uses OpenRouter as AI provider with Kimi K2 model for newsletter summarization.
 * Server-side only - API keys never exposed to client.
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

export interface OpenRouterConfig {
  apiKey: string
  model: string
  timeout: number
}

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/**
 * Generate a completion using OpenRouter API
 *
 * @param config - API configuration (key, model, timeout)
 * @param systemPrompt - System prompt for AI behavior
 * @param userPrompt - User prompt with content to process
 * @returns Generated completion text
 * @throws Error with "AI_TIMEOUT" message if request times out
 * @throws Error with API details if request fails
 */
export async function generateCompletion(
  config: OpenRouterConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeout)

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hushletter.com", // Required by OpenRouter
        "X-Title": "Hushletter", // Optional but recommended
      },
      body: JSON.stringify({
        model: config.model,
        provider: {
          "sort": "latency"
        },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500, // Concise summaries
        temperature: 0.3, // More deterministic for summaries
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        `OpenRouter API error: ${response.status} - ${JSON.stringify(error)}`
      )
    }

    const data = (await response.json()) as OpenRouterResponse
    const content = data.choices[0]?.message?.content
    if (!content) {
      throw new Error("OpenRouter returned empty or missing content")
    }
    return content
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI_TIMEOUT")
    }
    throw error
  }
}
