import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { ReaderView, clearContentCache } from "./ReaderView"

// Mock convex/react useAction
const mockGetNewsletterWithContent = vi.fn()

vi.mock("convex/react", () => ({
  useAction: () => mockGetNewsletterWithContent,
}))

// Mock DOMPurify with hooks support
vi.mock("dompurify", () => ({
  default: {
    sanitize: (html: string) => html.replace(/<script[^>]*>.*?<\/script>/gi, ""),
    addHook: vi.fn(),
    removeHook: vi.fn(),
  },
}))

// Mock fetch for R2 content
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("ReaderView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockGetNewsletterWithContent.mockReset()
    // Clear the content cache between tests
    clearContentCache()
  })

  describe("Loading State", () => {
    it("shows skeleton while loading content", () => {
      mockGetNewsletterWithContent.mockImplementation(() => new Promise(() => {}))

      render(<ReaderView userNewsletterId="test-id" />)

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

      render(<ReaderView userNewsletterId="test-id" />)

      await waitFor(() => {
        expect(screen.getByText("Newsletter content here")).toBeInTheDocument()
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

      render(<ReaderView userNewsletterId="test-id" />)

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
          "Public Newsletter"
        )
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

      render(<ReaderView userNewsletterId="test-id" />)

      await waitFor(() => {
        expect(screen.getByText("Private content")).toBeInTheDocument()
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

      render(<ReaderView userNewsletterId="test-id" />)

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

      render(<ReaderView userNewsletterId="test-id" />)

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

      render(<ReaderView userNewsletterId="test-id" />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load content/i)).toBeInTheDocument()
      })
    })

    it("shows error when action throws", async () => {
      mockGetNewsletterWithContent.mockRejectedValue(new Error("Network error"))

      render(<ReaderView userNewsletterId="test-id" />)

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

      render(<ReaderView userNewsletterId="test-id" />)

      await waitFor(() => {
        expect(screen.getByText("Safe content")).toBeInTheDocument()
        // Script tags should be removed by DOMPurify
        expect(document.querySelector("script")).not.toBeInTheDocument()
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

      const { rerender } = render(<ReaderView userNewsletterId="test-id-1" />)

      await waitFor(() => {
        expect(screen.getByText("First newsletter")).toBeInTheDocument()
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

      rerender(<ReaderView userNewsletterId="test-id-2" />)

      await waitFor(() => {
        expect(screen.getByText("Second newsletter")).toBeInTheDocument()
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
      const { unmount } = render(<ReaderView userNewsletterId="cached-test-id" />)

      await waitFor(() => {
        expect(screen.getByText("Cached content")).toBeInTheDocument()
      })

      expect(mockGetNewsletterWithContent).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Unmount and remount - should use cache
      unmount()

      // Reset mocks to verify they're not called again
      mockGetNewsletterWithContent.mockClear()
      mockFetch.mockClear()

      render(<ReaderView userNewsletterId="cached-test-id" />)

      await waitFor(() => {
        expect(screen.getByText("Cached content")).toBeInTheDocument()
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

      const { unmount } = render(<ReaderView userNewsletterId="error-test-id" />)

      await waitFor(() => {
        expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument()
      })

      expect(mockGetNewsletterWithContent).toHaveBeenCalledTimes(1)

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

      render(<ReaderView userNewsletterId="error-test-id" />)

      await waitFor(() => {
        expect(screen.getByText("Retry succeeded")).toBeInTheDocument()
      })

      // Should have fetched again since errors aren't cached
      expect(mockGetNewsletterWithContent).toHaveBeenCalledTimes(1)
    })
  })
})
