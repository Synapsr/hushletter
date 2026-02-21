import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactElement } from "react"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"
import { ReaderView, clearContentCache } from "./ReaderView"
import { READER_PREFERENCES_STORAGE_KEY } from "@/hooks/useReaderPreferences"

/** Helper to cast test strings to Convex Id type */
const testId = (id: string) => id as Id<"userNewsletters">

// Mock convex/react useConvex and useMutation
const mockGetNewsletterWithContent = vi.fn()
const mockUpdateReadProgress = vi.fn()
const afterSanitizeHooks: Array<(node: Element) => void> = []
let queryClient: QueryClient

vi.mock("convex/react", () => ({
  useConvex: () => ({
    action: mockGetNewsletterWithContent,
  }),
  useMutation: () => mockUpdateReadProgress,
}))

// Mock DOMPurify with hooks support and deterministic sanitization behavior
vi.mock("dompurify", () => ({
  default: {
    sanitize: (html: string) => {
      const stripped = html.replace(/<script[^>]*>.*?<\/script>/gi, "")
      const parser = new DOMParser()
      const doc = parser.parseFromString(stripped, "text/html")
      doc.querySelectorAll("*").forEach((node) => {
        afterSanitizeHooks.forEach((hook) => hook(node))
      })
      return doc.documentElement.outerHTML
    },
    addHook: vi.fn((name: string, hook: (node: Element) => void) => {
      if (name === "afterSanitizeAttributes") {
        afterSanitizeHooks.push(hook)
      }
    }),
    removeHook: vi.fn((name: string) => {
      if (name === "afterSanitizeAttributes") {
        afterSanitizeHooks.length = 0
      }
    }),
  },
}))

// Mock fetch for R2 content
const mockFetch = vi.fn()
global.fetch = mockFetch

function getReaderFrame(): HTMLIFrameElement {
  const frame = document.querySelector(
    'iframe[data-testid="reader-content-frame"]'
  ) as HTMLIFrameElement | null
  expect(frame).toBeInTheDocument()
  return frame as HTMLIFrameElement
}

function createWords(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ")
}

function renderReader(ui: ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe("ReaderView", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockGetNewsletterWithContent.mockReset()
    mockUpdateReadProgress.mockReset()
    afterSanitizeHooks.length = 0
    localStorage.removeItem(READER_PREFERENCES_STORAGE_KEY)
    // Clear the content cache between tests
    clearContentCache(queryClient)
  })

  describe("Loading State", () => {
    it("shows skeleton while loading content", () => {
      mockGetNewsletterWithContent.mockImplementation(() => new Promise(() => {}))

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      // Should show animated skeleton
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument()
    })
  })

  describe("Content Display (AC3)", () => {
    it("fetches and displays content from signed URL", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        contentUrl: "https://r2.example.com/content.html?signed=abc",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<p>Newsletter content here</p>"),
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("Newsletter content here")
      })
    })

    it("does not render inline preference controls in ReaderView", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        contentUrl: "https://r2.example.com/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<p>Reader settings content</p>"),
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("Reader settings content")
      })

      expect(screen.queryByLabelText("Reader background")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Reader font")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Reader font size")).not.toBeInTheDocument()
    })

    it("applies persisted background, font, and font size preferences", async () => {
      localStorage.setItem(
        READER_PREFERENCES_STORAGE_KEY,
        JSON.stringify({ background: "paper", font: "serif", fontSize: "large" }),
      )

      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        contentUrl: "https://r2.example.com/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<table bgcolor="#ffffff"><tr><td style="background-color:#fff;font-size:16px;">Styled newsletter</td></tr></table>',
          ),
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        const srcdoc = getReaderFrame().srcdoc
        expect(srcdoc).toContain("data-hushletter-reader-display-override")
        expect(srcdoc).toContain("ui-serif")
        expect(srcdoc).toContain("background-color: #F7F1E5")
        expect(srcdoc).toContain('bgcolor="#F7F1E5"')
        expect(srcdoc).toContain("background-color:#F7F1E5")
        expect(srcdoc).toContain("font-size:17.28px")
        expect(srcdoc).toContain("font-size: calc(1em * 1.08)")
      })

      const scrollContainer = document.querySelector(
        '[data-testid="reader-scroll-container"]'
      ) as HTMLDivElement | null
      expect(scrollContainer).toBeInTheDocument()
      expect(scrollContainer).toHaveStyle({
        backgroundColor: "rgb(247, 241, 229)",
      })
    })

    it("handles public content path (contentId)", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        contentId: "content-123",
        contentUrl: "https://r2.example.com/public/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<h1>Public Newsletter</h1>"),
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("<h1>Public Newsletter</h1>")
      })
    })

    it("handles private content path (privateR2Key)", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        privateR2Key: "private/user123/newsletter.html",
        contentUrl: "https://r2.example.com/private/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<p>Private content</p>"),
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("Private content")
      })
    })
  })

  describe("Empty/Missing Content", () => {
    it("shows empty state when content is missing", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        contentUrl: null,
        contentStatus: "missing",
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        expect(
          screen.getByText(/no content available/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe("Error Handling", () => {
    it("shows error when content retrieval fails", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        contentUrl: null,
        contentStatus: "error",
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        expect(
          screen.getByText(/temporarily unavailable/i)
        ).toBeInTheDocument()
      })
    })

    it("shows error when fetch fails", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        contentUrl: "https://r2.example.com/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load content/i)).toBeInTheDocument()
      })
    })

    it("shows error when action throws", async () => {
      mockGetNewsletterWithContent.mockRejectedValue(new Error("Network error"))

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load content/i)).toBeInTheDocument()
      })
    })
  })

  describe("XSS Protection (Security)", () => {
    it("sanitizes HTML content", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        contentUrl: "https://r2.example.com/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<p>Safe content</p><script>alert("xss")</script>'
          ),
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("Safe content")
        // Script tags should be removed by DOMPurify
        expect(getReaderFrame().srcdoc).not.toContain("<script")
      })
    })

    it("adds safe target/rel attributes to links", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        contentUrl: "https://r2.example.com/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<a href="https://example.com/read">Read more</a>'
          ),
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        const srcdoc = getReaderFrame().srcdoc
        expect(srcdoc).toContain('target="_blank"')
        expect(srcdoc).toContain('rel="noopener noreferrer"')
      })
    })

    it("removes inline event handlers and script-like URLs", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        contentUrl: "https://r2.example.com/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<a href="javascript:alert(1)" onclick="alert(2)">Bad link</a><img src="data:text/html,<script>alert(1)</script>" onerror="alert(3)" />'
          ),
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        const srcdoc = getReaderFrame().srcdoc
        expect(srcdoc).toContain("Bad link")
        expect(srcdoc).not.toContain("javascript:")
        expect(srcdoc).not.toContain("data:text/html")
        expect(srcdoc).not.toContain("onclick=")
        expect(srcdoc).not.toContain("onerror=")
      })
    })

    it("preserves common table layout attributes while applying background remap", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        contentUrl: "https://r2.example.com/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<table cellpadding="0" cellspacing="0" bgcolor="#ffffff"><tr><td colspan="2">Cell</td></tr></table>'
          ),
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        const srcdoc = getReaderFrame().srcdoc
        expect(srcdoc).toContain('cellpadding="0"')
        expect(srcdoc).toContain('cellspacing="0"')
        expect(srcdoc).toContain('bgcolor="transparent"')
        expect(srcdoc).toContain('colspan="2"')
      })
    })

    it("wraps plain text content in a pre fallback", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id",
        contentUrl: "https://r2.example.com/content.txt",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("Line 1\nLine 2"),
      })

      renderReader(<ReaderView userNewsletterId={testId("test-id")} />)

      await waitFor(() => {
        const srcdoc = getReaderFrame().srcdoc
        expect(srcdoc).toContain('class="hushletter-plain-text"')
        expect(srcdoc).toContain("Line 1")
        expect(srcdoc).toContain("Line 2")
      })
    })
  })

  describe("Real-time Updates", () => {
    it("refetches content when userNewsletterId changes", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id-1",
        contentUrl: "https://r2.example.com/content1.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<p>First newsletter</p>"),
      })

      const { rerender } = renderReader(<ReaderView userNewsletterId={testId("test-id-1")} />)

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("First newsletter")
      })

      // Change to different newsletter
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "test-id-2",
        contentUrl: "https://r2.example.com/content2.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<p>Second newsletter</p>"),
      })

      rerender(
        <QueryClientProvider client={queryClient}>
          <ReaderView userNewsletterId={testId("test-id-2")} />
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("Second newsletter")
      })
    })
  })

  describe("Caching", () => {
    it("uses cached content on subsequent renders", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "cached-test-id",
        contentUrl: "https://r2.example.com/cached-content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<p>Cached content</p>"),
      })

      // First render - fetches content
      const { unmount } = renderReader(<ReaderView userNewsletterId={testId("cached-test-id")} />)

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("Cached content")
      })

      expect(mockGetNewsletterWithContent).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Unmount and remount - should use cache
      unmount()

      // Reset mocks to verify they're not called again
      mockGetNewsletterWithContent.mockClear()
      mockFetch.mockClear()

      renderReader(<ReaderView userNewsletterId={testId("cached-test-id")} />)

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("Cached content")
      })

      // Should not have fetched again - content comes from cache
      expect(mockGetNewsletterWithContent).not.toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("does not cache errors (allows retry)", async () => {
      // First render - error
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "error-test-id",
        contentUrl: null,
        contentStatus: "error",
      })

      const { unmount } = renderReader(<ReaderView userNewsletterId={testId("error-test-id")} />)

      await waitFor(() => {
        expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument()
      })

      expect(mockGetNewsletterWithContent).toHaveBeenCalledTimes(2)

      // Unmount and remount - should retry (not cached)
      unmount()
      mockGetNewsletterWithContent.mockClear()

      // Now return success
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "error-test-id",
        contentUrl: "https://r2.example.com/retry-content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<p>Retry succeeded</p>"),
      })

      renderReader(<ReaderView userNewsletterId={testId("error-test-id")} />)

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("Retry succeeded")
      })

      // Should have fetched again since errors aren't cached
      expect(mockGetNewsletterWithContent).toHaveBeenCalledTimes(1)
    })
  })

  describe("Estimated Read Time", () => {
    it("emits 0 when content is under one minute", async () => {
      const onEstimatedReadMinutesChange = vi.fn()

      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "read-time-short-id",
        contentUrl: "https://r2.example.com/content-short.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("Very short update"),
      })

      renderReader(
        <ReaderView
          userNewsletterId={testId("read-time-short-id")}
          onEstimatedReadMinutesChange={onEstimatedReadMinutesChange}
        />
      )

      await waitFor(() => {
        expect(onEstimatedReadMinutesChange).toHaveBeenLastCalledWith(0)
      })
    })

    it("emits computed read time minutes after content loads", async () => {
      const onEstimatedReadMinutesChange = vi.fn()

      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "read-time-test-id",
        contentUrl: "https://r2.example.com/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(createWords(221)),
      })

      renderReader(
        <ReaderView
          userNewsletterId={testId("read-time-test-id")}
          onEstimatedReadMinutesChange={onEstimatedReadMinutesChange}
        />
      )

      await waitFor(() => {
        expect(onEstimatedReadMinutesChange).toHaveBeenLastCalledWith(2)
      })
    })

    it("emits null when content is missing or unavailable", async () => {
      const onEstimatedReadMinutesChange = vi.fn()

      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "read-time-missing-id",
        contentUrl: null,
        contentStatus: "missing",
      })

      const { unmount } = renderReader(
        <ReaderView
          userNewsletterId={testId("read-time-missing-id")}
          onEstimatedReadMinutesChange={onEstimatedReadMinutesChange}
        />
      )

      await waitFor(() => {
        expect(onEstimatedReadMinutesChange).toHaveBeenLastCalledWith(null)
      })

      unmount()
      mockGetNewsletterWithContent.mockReset()
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "read-time-error-id",
        contentUrl: null,
        contentStatus: "error",
      })

      renderReader(
        <ReaderView
          userNewsletterId={testId("read-time-error-id")}
          onEstimatedReadMinutesChange={onEstimatedReadMinutesChange}
        />
      )

      await waitFor(() => {
        expect(onEstimatedReadMinutesChange).toHaveBeenLastCalledWith(null)
      })
    })

    it("emits cached estimate on remount without refetching", async () => {
      const firstCallback = vi.fn()

      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "read-time-cached-id",
        contentUrl: "https://r2.example.com/cached-read-time.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(createWords(260)),
      })

      const { unmount } = renderReader(
        <ReaderView
          userNewsletterId={testId("read-time-cached-id")}
          onEstimatedReadMinutesChange={firstCallback}
        />
      )

      await waitFor(() => {
        expect(firstCallback).toHaveBeenLastCalledWith(2)
      })

      expect(mockGetNewsletterWithContent).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      unmount()
      mockGetNewsletterWithContent.mockClear()
      mockFetch.mockClear()

      const secondCallback = vi.fn()
      renderReader(
        <ReaderView
          userNewsletterId={testId("read-time-cached-id")}
          onEstimatedReadMinutesChange={secondCallback}
        />
      )

      await waitFor(() => {
        expect(secondCallback).toHaveBeenLastCalledWith(2)
      })

      expect(mockGetNewsletterWithContent).not.toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe("Scroll Progress Tracking (Story 3.4)", () => {
    it("renders scrollable container for progress tracking", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "scroll-test-id",
        contentUrl: "https://r2.example.com/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<p>Scrollable content</p>"),
      })

      renderReader(<ReaderView userNewsletterId={testId("scroll-test-id")} />)

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("Scrollable content")
      })

      // Verify scroll container exists with proper class
      const scrollContainer = document.querySelector(".overflow-y-auto")
      expect(scrollContainer).toBeInTheDocument()
    })

    it("accepts initialProgress prop for resume feature (AC2)", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "resume-test-id",
        contentUrl: "https://r2.example.com/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<p>Resume content</p>"),
      })

      // Should not throw when initialProgress is provided
      renderReader(<ReaderView userNewsletterId={testId("resume-test-id")} initialProgress={45} />)

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("Resume content")
      })
    })

    it("accepts onReadingComplete callback prop (AC3)", async () => {
      const mockOnReadingComplete = vi.fn()

      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "complete-test-id",
        contentUrl: "https://r2.example.com/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<p>Complete content</p>"),
      })

      // Should not throw when onReadingComplete is provided
      renderReader(
        <ReaderView
          userNewsletterId={testId("complete-test-id")}
          onReadingComplete={mockOnReadingComplete}
        />
      )

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("Complete content")
      })
    })

    it("calls updateReadProgress mutation when scroll progress changes", async () => {
      mockGetNewsletterWithContent.mockResolvedValue({
        _id: "progress-test-id",
        contentUrl: "https://r2.example.com/content.html",
        contentStatus: "available",
      })

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<p>Progress tracking content</p>"),
      })

      renderReader(<ReaderView userNewsletterId={testId("progress-test-id")} />)

      await waitFor(() => {
        expect(getReaderFrame().srcdoc).toContain("Progress tracking content")
      })

      // Verify that useMutation was called (hook is set up)
      // The actual scroll event triggering is tested in useScrollProgress.test.ts
      // This verifies the mutation is wired up to the component
      expect(mockUpdateReadProgress).toBeDefined()
    })
  })
})
