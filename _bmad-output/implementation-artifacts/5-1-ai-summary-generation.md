# Story 5.1: AI Summary Generation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user reading a newsletter**,
I want **to generate an AI summary with one click**,
So that **I can quickly understand the key points when I don't have time to read the full content**.

## Acceptance Criteria

1. **Given** I am viewing a newsletter in the reader
   **When** I click the "Summarize" button
   **Then** the system sends the newsletter content to the AI service
   **And** I see a loading indicator while the summary is being generated

2. **Given** the AI is generating a summary
   **When** the process completes
   **Then** the summary is returned within 10 seconds (NFR3)
   **And** the summary is stored in the database with the newsletter

3. **Given** the AI service is unavailable or fails
   **When** I request a summary
   **Then** I see a friendly error message
   **And** the reading experience is not blocked (NFR11)
   **And** I can retry later

4. **Given** a newsletter already has a generated summary
   **When** I view that newsletter
   **Then** the existing summary is displayed
   **And** I don't need to regenerate it

5. **Given** I want to regenerate a summary
   **When** I click "Regenerate Summary"
   **Then** a new summary is generated
   **And** it is stored as my personal summary (even for public newsletters)
   **And** my personal summary takes precedence over the shared one

## Tasks / Subtasks

- [x] **Task 1: Schema Update for Summary Storage** (AC: #2, #4)
  - [x] 1.1: Add `summary` and `summaryGeneratedAt` fields to `newsletterContent` table (shared summaries for public newsletters)
  - [x] 1.2: Add `summary` and `summaryGeneratedAt` fields to `userNewsletters` table (private newsletters only)
  - [x] 1.3: Run `npx convex dev` to validate schema migration
  - [x] 1.4: Document: Public newsletters use shared summary, private newsletters use per-user summary

- [x] **Task 2: OpenRouter Client Setup** (AC: #1, #2)
  - [x] 2.1: Create `packages/backend/convex/lib/openrouter.ts` with OpenRouter client configuration
  - [x] 2.2: Set up environment variable `OPENROUTER_API_KEY` in Convex dashboard
  - [x] 2.3: Configure model: `moonshotai/kimi-k2` (per architecture spec)
  - [x] 2.4: Set timeout to 30 seconds with early abort if response taking too long
  - [x] 2.5: Add rate limiting consideration (document in code)

- [x] **Task 3: Create AI Summary Action** (AC: #1, #2, #3, #5)
  - [x] 3.1: Create `packages/backend/convex/ai.ts` with `generateSummary` action
  - [x] 3.2: Accept `userNewsletterId` and `forceRegenerate` (boolean) parameters
  - [x] 3.3: If NOT forceRegenerate: Check for existing summary (personal first, then shared) → return if found
  - [x] 3.4: Fetch newsletter content (from R2 via existing action pattern)
  - [x] 3.5: Strip HTML to plain text for AI context (reduce tokens)
  - [x] 3.6: Construct prompt for concise summary (key points, main topics, takeaways)
  - [x] 3.7: Call OpenRouter API with Kimi K2 model
  - [x] 3.8: Store summary based on context:
    - First generation (public): Store on `newsletterContent.summary` (shared)
    - Regeneration (any) or private: Store on `userNewsletters.summary` (personal)
  - [x] 3.9: Return summary text to client
  - [x] 3.10: Handle timeout with ConvexError (code: "AI_TIMEOUT")
  - [x] 3.11: Handle API errors gracefully with ConvexError (code: "AI_UNAVAILABLE")

- [x] **Task 4: Create Summary Query** (AC: #4)
  - [x] 4.1: Add `getNewsletterSummary` query to `packages/backend/convex/ai.ts`
  - [x] 4.2: For PUBLIC newsletters: Check `newsletterContent.summary` (shared)
  - [x] 4.3: For PRIVATE newsletters: Check `userNewsletters.summary` (per-user)
  - [x] 4.4: Return summary with source indicator (shared vs private)
  - [x] 4.5: Return null if no summary generated yet

- [x] **Task 5: Create SummaryPanel Component** (AC: #1, #3, #4, #5)
  - [x] 5.1: Create `apps/web/src/components/SummaryPanel.tsx`
  - [x] 5.2: Show "Summarize" button when no summary exists
  - [x] 5.3: Show loading state with spinner during generation (animated skeleton)
  - [x] 5.4: Display summary content when available
  - [x] 5.5: Show "Regenerate" button when summary exists
  - [x] 5.6: Handle errors with friendly message and retry button
  - [x] 5.7: Use error boundary for component isolation (NFR11)

- [x] **Task 6: Integrate SummaryPanel into Reader** (AC: #1, #4)
  - [x] 6.1: Add SummaryPanel to `apps/web/src/routes/_authed/newsletters/$id.tsx`
  - [x] 6.2: Position above newsletter content (collapsible per UX spec)
  - [x] 6.3: Pass `userNewsletterId` to SummaryPanel
  - [x] 6.4: Ensure summary panel doesn't block content on error

- [x] **Task 7: Write Tests** (All ACs)
  - [x] 7.1: Test OpenRouter client initialization
  - [x] 7.2: Test `generateSummary` first generation (public) stores on `newsletterContent`
  - [x] 7.3: Test `generateSummary` first generation (private) stores on `userNewsletters`
  - [x] 7.4: Test `generateSummary` returns existing shared summary without API call
  - [x] 7.5: Test `generateSummary` returns existing personal summary without API call
  - [x] 7.6: Test `generateSummary` with `forceRegenerate=true` ALWAYS stores on `userNewsletters`
  - [x] 7.7: Test `generateSummary` timeout handling
  - [x] 7.8: Test `generateSummary` API error handling
  - [x] 7.9: Test `getNewsletterSummary` returns personal summary with priority
  - [x] 7.10: Test `getNewsletterSummary` returns shared summary if no personal
  - [x] 7.11: Test `getNewsletterSummary` returns `isShared: true` for shared summaries
  - [x] 7.12: Test SummaryPanel loading state
  - [x] 7.13: Test SummaryPanel displays "Community summary" badge for shared
  - [x] 7.14: Test SummaryPanel regenerate calls with `forceRegenerate=true`
  - [x] 7.15: Test SummaryPanel error state
  - [x] 7.16: Test reader view integration (summary visible)

## Dev Notes

### Architecture Patterns & Constraints

**AI Integration Pattern (from Architecture):**
- Provider: OpenRouter + Kimi K2 (moonshotai/kimi-k2)
- Integration: On-demand (user-triggered), NOT automatic/background
- Location: `convex/ai.ts` for AI-related actions
- Function naming: `generateSummary` (action)

**Critical Design Decisions:**
1. **Server-side only** - API keys never exposed to client (NFR6)
2. **User-triggered** - No automatic summarization (simpler, cheaper for MVP)
3. **Shared summaries for public content** - First user to generate shares with all (cost optimization)
4. **Private newsletters stay private** - Per-user summaries only for private content
5. **Non-blocking** - Error boundary ensures reading works even if AI fails

**Schema Addition:**
```typescript
// Add to newsletterContent table (SHARED summaries for public newsletters)
summary: v.optional(v.string()),
summaryGeneratedAt: v.optional(v.number()), // Unix timestamp ms

// Add to userNewsletters table (PRIVATE summaries only)
summary: v.optional(v.string()),
summaryGeneratedAt: v.optional(v.number()), // Unix timestamp ms
```

**Shared Summary Architecture (Cost Optimization):**
- **Public newsletters** (`contentId` set): Summary stored on `newsletterContent.summary`
  - First user to generate pays the API cost
  - All subsequent users get instant summary (no API call)
  - Significant cost savings for popular newsletters
- **Private newsletters** (`privateR2Key` set): Summary stored on `userNewsletters.summary`
  - Each user generates their own (privacy maintained)
  - Follows Epic 2.5 privacy architecture

**Regeneration Behavior:**
- **Regenerate on public newsletter**: Creates PERSONAL summary on `userNewsletters.summary`
  - Does NOT overwrite shared summary (would affect other users)
  - User's personal summary takes precedence over shared
- **Regenerate on private newsletter**: Replaces existing `userNewsletters.summary`

**Summary Resolution Logic (Priority Order):**
```
1. Check userNewsletters.summary (personal override)
2. IF public AND no personal: Check newsletterContent.summary (shared)
3. IF nothing found: No summary available
```

**Cost Flow:**
```
First request (public):
  → Has shared summary? Return it (FREE)
  → No shared? Generate → Store on newsletterContent (SHARED)

Regenerate (any):
  → Always generate new → Store on userNewsletters (PERSONAL)
```

### OpenRouter Integration Pattern

**Client Configuration:**
```typescript
// packages/backend/convex/lib/openrouter.ts
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

interface OpenRouterConfig {
  apiKey: string
  model: string
  timeout: number
}

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
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://newsletter-manager.app", // Required by OpenRouter
        "X-Title": "Newsletter Manager", // Optional but recommended
      },
      body: JSON.stringify({
        model: config.model,
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
      throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(error)}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content ?? ""
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI_TIMEOUT")
    }
    throw error
  }
}
```

### generateSummary Action Pattern

```typescript
// packages/backend/convex/ai.ts
import { action, internalMutation, internalQuery, query } from "./_generated/server"
import { v } from "convex/values"
import { ConvexError } from "convex/values"
import { api, internal } from "./_generated/api"
import { generateCompletion } from "./lib/openrouter"

const SUMMARY_SYSTEM_PROMPT = `You are a helpful assistant that summarizes newsletter content.
Create a concise summary that captures:
- Key points and main topics (3-5 bullet points)
- Important takeaways
- Any action items or deadlines mentioned

Keep the summary under 200 words. Use clear, simple language.
Format as a brief introduction followed by bullet points.`

export const generateSummary = action({
  args: {
    userNewsletterId: v.string(),
    forceRegenerate: v.optional(v.boolean()), // true = user clicked "Regenerate"
  },
  handler: async (ctx, { userNewsletterId, forceRegenerate }): Promise<{ summary: string }> => {
    // Get newsletter metadata to check if public/private
    const newsletter = await ctx.runQuery(internal.ai.getNewsletterForSummary, {
      userNewsletterId,
    })

    if (!newsletter) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter not found",
      })
    }

    // COST OPTIMIZATION: Check for existing summary (unless regenerating)
    if (!forceRegenerate) {
      // Priority 1: Check personal summary (userNewsletters)
      if (newsletter.summary) {
        return { summary: newsletter.summary }
      }

      // Priority 2: Check shared summary (public newsletters only)
      if (!newsletter.isPrivate && newsletter.contentId) {
        const sharedSummary = await ctx.runQuery(internal.ai.getSharedSummary, {
          contentId: newsletter.contentId,
        })

        if (sharedSummary) {
          // Return existing shared summary - NO API CALL NEEDED!
          return { summary: sharedSummary }
        }
      }
    }

    // Get newsletter content (validates access internally)
    const result = await ctx.runAction(api.newsletters.getUserNewsletterWithContent, {
      userNewsletterId,
    })

    if (result.contentStatus !== "available" || !result.contentUrl) {
      throw new ConvexError({
        code: "CONTENT_UNAVAILABLE",
        message: "Newsletter content is not available for summarization",
      })
    }

    // Fetch content from R2
    const response = await fetch(result.contentUrl)
    if (!response.ok) {
      throw new ConvexError({
        code: "CONTENT_FETCH_ERROR",
        message: "Failed to fetch newsletter content",
      })
    }

    const html = await response.text()

    // Strip HTML to plain text (reduce tokens, cleaner input)
    const plainText = stripHtmlToText(html)

    // Truncate to reasonable length (prevent token overflow)
    const truncatedText = plainText.slice(0, 15000) // ~3750 tokens approx

    // Get API key from environment
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new ConvexError({
        code: "AI_CONFIG_ERROR",
        message: "AI service is not configured",
      })
    }

    try {
      const summary = await generateCompletion(
        {
          apiKey,
          model: "moonshotai/kimi-k2",
          timeout: 25000, // 25s timeout (NFR3: 10s target, allow some buffer)
        },
        SUMMARY_SYSTEM_PROMPT,
        `Summarize this newsletter:\n\n${truncatedText}`
      )

      // Determine where to store the summary
      const isFirstGenerationForPublic = !forceRegenerate && !newsletter.isPrivate && newsletter.contentId

      if (isFirstGenerationForPublic) {
        // FIRST GENERATION (PUBLIC): Store on shared newsletterContent (benefits all users)
        await ctx.runMutation(internal.ai.storeSharedSummary, {
          contentId: newsletter.contentId,
          summary,
        })
      } else {
        // REGENERATION or PRIVATE: Store on user's record (personal summary)
        await ctx.runMutation(internal.ai.storePrivateSummary, {
          userNewsletterId,
          summary,
        })
      }

      return { summary }
    } catch (error) {
      if (error instanceof Error && error.message === "AI_TIMEOUT") {
        throw new ConvexError({
          code: "AI_TIMEOUT",
          message: "Summary generation took too long. Please try again.",
        })
      }

      console.error("[generateSummary] AI error:", error)
      throw new ConvexError({
        code: "AI_UNAVAILABLE",
        message: "AI service is temporarily unavailable. Please try again later.",
      })
    }
  },
})

// Internal query to get newsletter metadata for summary logic
export const getNewsletterForSummary = internalQuery({
  args: { userNewsletterId: v.string() },
  handler: async (ctx, { userNewsletterId }) => {
    return await ctx.db.get(userNewsletterId as any)
  },
})

// Internal query to check for existing shared summary
export const getSharedSummary = internalQuery({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, { contentId }) => {
    const content = await ctx.db.get(contentId)
    return content?.summary ?? null
  },
})

// Internal mutation to store SHARED summary (public newsletters)
export const storeSharedSummary = internalMutation({
  args: {
    contentId: v.id("newsletterContent"),
    summary: v.string(),
  },
  handler: async (ctx, { contentId, summary }) => {
    await ctx.db.patch(contentId, {
      summary,
      summaryGeneratedAt: Date.now(),
    })
  },
})

// Internal mutation to store PRIVATE summary (private newsletters only)
export const storePrivateSummary = internalMutation({
  args: {
    userNewsletterId: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, { userNewsletterId, summary }) => {
    await ctx.db.patch(userNewsletterId as any, {
      summary,
      summaryGeneratedAt: Date.now(),
    })
  },
})

// PUBLIC QUERY: Get summary for a newsletter (resolves personal vs shared)
export const getNewsletterSummary = query({
  args: { userNewsletterId: v.string() },
  handler: async (ctx, { userNewsletterId }): Promise<{ summary: string | null, isShared: boolean }> => {
    const newsletter = await ctx.db.get(userNewsletterId as any)
    if (!newsletter) {
      return { summary: null, isShared: false }
    }

    // Priority 1: Personal summary (userNewsletters)
    if (newsletter.summary) {
      return { summary: newsletter.summary, isShared: false }
    }

    // Priority 2: Shared summary (public newsletters only)
    if (!newsletter.isPrivate && newsletter.contentId) {
      const content = await ctx.db.get(newsletter.contentId)
      if (content?.summary) {
        return { summary: content.summary, isShared: true }
      }
    }

    // No summary available
    return { summary: null, isShared: false }
  },
})

// Helper: Strip HTML tags and normalize whitespace
function stripHtmlToText(html: string): string {
  return html
    // Remove script and style content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    // Replace common block elements with newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n")
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim()
}
```

### SummaryPanel Component Pattern

```tsx
// apps/web/src/components/SummaryPanel.tsx
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAction } from "convex/react"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, Users } from "lucide-react"
import { ConvexError } from "convex/values"

interface SummaryPanelProps {
  userNewsletterId: string
}

export function SummaryPanel({ userNewsletterId }: SummaryPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  // Exception: useAction doesn't provide isPending, manual state required
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Query for existing summary (resolves shared vs private automatically)
  // Returns: { summary: string | null, isShared: boolean }
  const { data: summaryData } = useQuery(
    convexQuery(api.ai.getNewsletterSummary, { userNewsletterId })
  )

  const generateSummaryAction = useAction(api.ai.generateSummary)

  const handleGenerate = async (forceRegenerate = false) => {
    setIsGenerating(true)
    setError(null)

    try {
      await generateSummaryAction({ userNewsletterId, forceRegenerate })
      // Summary will appear via real-time subscription
    } catch (err) {
      if (err instanceof ConvexError) {
        setError(err.data.message)
      } else {
        setError("Failed to generate summary. Please try again.")
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const hasSummary = summaryData?.summary
  const isSharedSummary = summaryData?.isShared

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            AI Summary
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Collapse/Expand toggle */}
            {hasSummary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8 p-0"
              >
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent>
          {/* Error state */}
          {error && (
            <div className="text-sm text-destructive mb-4 p-3 bg-destructive/10 rounded-lg">
              {error}
            </div>
          )}

          {/* Loading state */}
          {isGenerating && (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-5/6" />
              <div className="h-4 bg-muted rounded w-4/5" />
            </div>
          )}

          {/* Summary content */}
          {!isGenerating && hasSummary && (
            <div className="space-y-2">
              {/* Shared summary indicator (optional UX enhancement) */}
              {isSharedSummary && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>Community summary</span>
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {summaryData.summary}
                </p>
              </div>
            </div>
          )}

          {/* Generate/Regenerate button */}
          {!isGenerating && (
            <div className="mt-4 flex justify-end">
              <Button
                variant={hasSummary ? "outline" : "default"}
                size="sm"
                onClick={() => handleGenerate(!!hasSummary)} // forceRegenerate = true if regenerating
                disabled={isGenerating}
                className="gap-2"
              >
                {hasSummary ? (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Summarize
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Empty state guidance */}
          {!isGenerating && !hasSummary && !error && (
            <p className="text-sm text-muted-foreground mb-4">
              Generate an AI summary to quickly understand the key points of this newsletter.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
```

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `packages/backend/convex/schema.ts` | MODIFY | Add summary fields to userNewsletters |
| `packages/backend/convex/lib/openrouter.ts` | NEW | OpenRouter API client |
| `packages/backend/convex/ai.ts` | NEW | AI actions (generateSummary) |
| `apps/web/src/components/SummaryPanel.tsx` | NEW | Summary display component |
| `apps/web/src/components/SummaryPanel.test.tsx` | NEW | Component tests |
| `packages/backend/convex/ai.test.ts` | NEW | Action tests |
| `apps/web/src/routes/_authed/newsletters/$id.tsx` | MODIFY | Integrate SummaryPanel |

### Project Structure Notes

- OpenRouter client in `convex/lib/` follows existing pattern (internal utilities)
- `ai.ts` file for AI-related functions per architecture spec
- SummaryPanel colocated in components (shared, not route-specific)
- Tests colocated with source files

### Critical Implementation Rules

1. **API Key Security** - OPENROUTER_API_KEY must be in Convex environment variables, never in code
2. **User Access Validation** - `generateSummary` must validate user owns the newsletter before processing
3. **Error Isolation** - SummaryPanel wrapped in error boundary to not block reading (NFR11)
4. **Timeout Handling** - 25-30s max for AI call (NFR3: <10s target, but allow buffer)
5. **ConvexError Pattern** - Use structured errors with codes for user-actionable messages
6. **No useState for Convex Data** - Exception: useAction doesn't have isPending, manual loading state OK

### UX Design Considerations (from UX Spec)

**Emotional Goals:**
- "Helpful efficiency" - Summary feels like a personal assistant
- "Instant display" - Loading state should be graceful, not anxious

**UX Patterns to Follow:**
- AI summaries are "helpful tool, never mandatory or intrusive"
- Reading experience must never be blocked by AI features
- Summary should be collapsible (user preference for focus vs assistance)

**Anti-patterns to Avoid:**
- Don't auto-generate summaries without user action
- Don't show intrusive loading states
- Don't make summary required to access content

### Security Considerations

**API Key Protection:**
- OpenRouter API key stored in Convex environment variables
- Never exposed to client (server action pattern)
- Key is scoped to OpenRouter only (not admin access)

**Content Access:**
- Summary generation validates user owns the newsletter
- Reuses existing `getUserNewsletterWithContent` action which has auth checks
- Summary stored per-user, not shared (privacy boundary maintained)

**Rate Limiting:**
- OpenRouter has built-in rate limiting
- Consider adding per-user cooldown if abuse occurs (future enhancement)

### Error Handling Patterns

```typescript
// Error codes for AI operations
type AIErrorCode =
  | "AI_TIMEOUT"        // Generation took too long
  | "AI_UNAVAILABLE"    // OpenRouter service down
  | "AI_CONFIG_ERROR"   // Missing API key
  | "CONTENT_UNAVAILABLE" // Newsletter content not accessible
  | "CONTENT_FETCH_ERROR" // Failed to fetch from R2

// Client-side error handling
if (err instanceof ConvexError) {
  switch (err.data.code) {
    case "AI_TIMEOUT":
      setError("Summary generation took too long. Please try again.")
      break
    case "AI_UNAVAILABLE":
      setError("AI service is temporarily unavailable.")
      break
    default:
      setError(err.data.message)
  }
}
```

### Testing Requirements

**Unit Tests (ai.ts):**
- Mock OpenRouter API responses
- Test successful summary generation
- Test timeout handling
- Test API error handling
- Test content validation
- Test summary storage

**Component Tests (SummaryPanel.tsx):**
- Test loading state rendering
- Test summary display
- Test generate button click
- Test regenerate button click
- Test error state rendering
- Test collapsed/expanded toggle
- Test empty state

**Integration Tests:**
- Test end-to-end flow: click Summarize → loading → summary displayed
- Test error recovery: error → retry → success

### Dependencies

**Existing Dependencies (no install needed):**
- `convex` - Already installed
- `lucide-react` - Already installed
- Tailwind CSS - Already configured

**No New Dependencies Required:**
- OpenRouter uses standard `fetch` API
- HTML-to-text conversion uses built-in regex (no external library)

### Git Intelligence

**Recent Commit Patterns (Epic 4):**
- `3b14eb2` - feat: Add Gmail disconnect with confirmation dialog and code review fixes
- Pattern: Single commit with implementation + code review fixes
- Tests included in same commit as implementation

**Commit Message Format:**
```
feat: Add AI newsletter summary generation (Story 5.1)

- Add summary fields to userNewsletters schema
- Create OpenRouter client for Kimi K2 integration
- Add generateSummary action with timeout handling
- Create SummaryPanel component with loading/error states
- Integrate SummaryPanel into newsletter reader view
- Add comprehensive tests for AI features
```

### References

- [Source: planning-artifacts/epics.md#Story 5.1] - Original acceptance criteria
- [Source: planning-artifacts/architecture.md#API & Communication Patterns] - AI provider choice
- [Source: planning-artifacts/architecture.md#Frontend Architecture] - Error boundary pattern
- [Source: project-context.md#Critical Implementation Rules] - Convex patterns
- [Source: planning-artifacts/ux-design-specification.md#Micro-Emotions] - "Generating AI summary" emotion
- [Source: planning-artifacts/prd.md#NFR3] - 10 second summary generation target
- [Source: planning-artifacts/prd.md#NFR11] - AI failure isolation

### Web Research Summary

**OpenRouter API (2026):**
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Auth: Bearer token in Authorization header
- Required headers: HTTP-Referer (your app URL)
- Model: `moonshotai/kimi-k2` for cost-effective summaries
- Pricing: Variable by model, Kimi K2 is cost-effective

**Kimi K2 Model Notes:**
- Good for summarization tasks
- Supports up to 128k context (more than enough for newsletters)
- Fast response times (typically under 5 seconds)
- Cost-effective compared to GPT-4 alternatives

**Best Practices for Newsletter Summarization:**
- Strip HTML before sending (reduces tokens, cleaner output)
- Use temperature 0.3-0.5 for consistent summaries
- Limit max_tokens to prevent over-long responses
- Include clear system prompt with output format expectations

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Schema migration validated successfully via `npx convex dev --once`
- Backend tests: 464 passed (including 20 new ai.test.ts tests)
- Frontend SummaryPanel tests: 18 passed

### Completion Notes List

- **Task 1**: Added `summary` and `summaryGeneratedAt` optional fields to both `newsletterContent` (shared) and `userNewsletters` (personal) tables. Schema validated successfully.

- **Task 2**: Created OpenRouter client at `packages/backend/convex/lib/openrouter.ts` with proper timeout handling via AbortController, error handling for AI_TIMEOUT, and configuration for Kimi K2 model. Note: User must set `OPENROUTER_API_KEY` in Convex dashboard.

- **Task 3**: Created `packages/backend/convex/ai.ts` with `generateSummary` action implementing:
  - Authentication and ownership validation
  - Cost optimization (returns existing summary without API call when available)
  - Shared summary storage for first public generation
  - Personal summary storage for regeneration or private newsletters
  - Proper error handling with structured ConvexError codes

- **Task 4**: Added `getNewsletterSummary` query with priority resolution (personal > shared > null) and `isShared` indicator for UI.

- **Task 5**: Created `SummaryPanel.tsx` component with:
  - Collapsible UI with proper accessibility (aria-expanded)
  - Loading skeleton animation during generation
  - "Community summary" badge for shared summaries
  - Error state with friendly message
  - Summarize/Regenerate buttons

- **Task 6**: Integrated SummaryPanel into newsletter reader page wrapped in ErrorBoundary per NFR11. Summary panel positioned above content.

- **Task 7**: Added comprehensive tests - 20 backend contract tests and 18 frontend component tests covering all specified test cases.

### File List

**New Files:**
- `packages/backend/convex/lib/openrouter.ts` - OpenRouter API client
- `packages/backend/convex/ai.ts` - AI summary action and queries
- `packages/backend/convex/ai.test.ts` - Backend contract tests (20 tests)
- `apps/web/src/components/SummaryPanel.tsx` - Summary display component
- `apps/web/src/components/SummaryPanel.test.tsx` - Component tests (18 tests)

**Modified Files:**
- `packages/backend/convex/schema.ts` - Added summary fields to newsletterContent and userNewsletters
- `apps/web/src/routes/_authed/newsletters/$id.tsx` - Integrated SummaryPanel with ErrorBoundary
- `_bmad-output/planning-artifacts/ux-design-specification.md` - Updated for AI summary UX patterns

## Change Log

- **2026-01-24**: Story 5.1 implemented - AI Summary Generation with OpenRouter/Kimi K2 integration, cost-optimized shared summaries for public newsletters, SummaryPanel component with collapsible UI, comprehensive tests (38 total)
- **2026-01-24**: Code review fixes applied (6 issues fixed):
  - HIGH-1: Added proper `Id<"userNewsletters">` type to SummaryPanel props for type safety
  - HIGH-2: Added 13 behavioral unit tests for `stripHtmlToText` helper (exported for testing)
  - HIGH-3: Fixed openrouter.ts to throw error on empty AI response instead of returning empty string
  - MEDIUM-2: Added SummaryErrorFallback component with retry button for AI error boundary
  - MEDIUM-3: Extended HTML entity decoding with 30+ common entities and numeric entity support (decimal/hex)
  - MEDIUM-4: Replaced type assertion with type guard for safer type narrowing in SummaryPanel
  - LOW-2: Extracted magic number to named constant `MAX_CONTENT_LENGTH`
  - Tests: Backend now 477 tests (33 new in ai.test.ts), Frontend 18 SummaryPanel tests
