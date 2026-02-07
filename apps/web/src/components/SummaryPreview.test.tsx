import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SummaryPreview } from "./SummaryPreview"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"

// Mock TanStack Router's Link component
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

// Mock the convex query
const mockQueryResult = vi.fn()
vi.mock("@convex-dev/react-query", () => ({
  convexQuery: () => ({
    queryKey: ["test-query"],
    queryFn: mockQueryResult,
  }),
}))

// Mock the api
vi.mock("@hushletter/backend", () => ({
  api: {
    ai: {
      getNewsletterSummary: "getNewsletterSummary",
    },
  },
}))

/**
 * Tests for SummaryPreview component
 * Story 5.2: Task 6.9, 6.10 - Summary preview tests
 */

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("SummaryPreview", () => {
  const mockUserNewsletterId = "test-newsletter-id" as Id<"userNewsletters">

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders toggle button initially", () => {
      render(
        <SummaryPreview userNewsletterId={mockUserNewsletterId} />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText("Show summary")).toBeInTheDocument()
    })

    it("shows sparkles icon in toggle button", () => {
      render(
        <SummaryPreview userNewsletterId={mockUserNewsletterId} />,
        { wrapper: createWrapper() }
      )

      // Check for button with Sparkles icon (lucide-react uses svg)
      const button = screen.getByRole("button")
      expect(button.querySelector("svg")).toBeInTheDocument()
    })
  })

  describe("Expand/Collapse (Task 3)", () => {
    it("expands preview when toggle button clicked", async () => {
      mockQueryResult.mockResolvedValue({
        summary: "This is a test summary",
        isShared: false,
      })

      render(
        <SummaryPreview userNewsletterId={mockUserNewsletterId} />,
        { wrapper: createWrapper() }
      )

      const toggleButton = screen.getByRole("button")
      await fireEvent.click(toggleButton)

      // Button text should change
      expect(screen.getByText("Hide preview")).toBeInTheDocument()
    })

    it("collapses preview when toggle button clicked again", async () => {
      mockQueryResult.mockResolvedValue({
        summary: "This is a test summary",
        isShared: false,
      })

      render(
        <SummaryPreview userNewsletterId={mockUserNewsletterId} />,
        { wrapper: createWrapper() }
      )

      const toggleButton = screen.getByRole("button")

      // Expand
      await fireEvent.click(toggleButton)
      expect(screen.getByText("Hide preview")).toBeInTheDocument()

      // Collapse
      await fireEvent.click(toggleButton)
      expect(screen.getByText("Show summary")).toBeInTheDocument()
    })
  })

  describe("Task 6.10: Loading State", () => {
    it("shows loading skeleton while fetching", async () => {
      // Make the query hang
      mockQueryResult.mockImplementation(() => new Promise(() => {}))

      render(
        <SummaryPreview userNewsletterId={mockUserNewsletterId} />,
        { wrapper: createWrapper() }
      )

      // Expand to trigger fetch
      const toggleButton = screen.getByRole("button")
      await fireEvent.click(toggleButton)

      // Should show loading indicator
      await waitFor(() => {
        expect(screen.getByLabelText("Loading summary...")).toBeInTheDocument()
      })
    })
  })

  describe("Task 6.9: Summary Truncation", () => {
    it("truncates long summaries to ~100 characters", async () => {
      const longSummary =
        "This is a very long summary that exceeds the maximum character limit and should be truncated to show only the first portion with an ellipsis at the end"

      mockQueryResult.mockResolvedValue({
        summary: longSummary,
        isShared: false,
      })

      render(
        <SummaryPreview userNewsletterId={mockUserNewsletterId} />,
        { wrapper: createWrapper() }
      )

      // Expand
      const toggleButton = screen.getByRole("button")
      await fireEvent.click(toggleButton)

      await waitFor(() => {
        // Should see truncated text with ellipsis
        const previewText = screen.getByText(/This is a very long summary/i)
        expect(previewText.textContent?.length).toBeLessThan(longSummary.length)
        expect(previewText.textContent).toContain("...")
      })
    })

    it("shows 'Read more' link when truncated", async () => {
      const longSummary =
        "This is a very long summary that exceeds the maximum character limit and should be truncated to show only the first portion with an ellipsis at the end"

      mockQueryResult.mockResolvedValue({
        summary: longSummary,
        isShared: false,
      })

      render(
        <SummaryPreview userNewsletterId={mockUserNewsletterId} />,
        { wrapper: createWrapper() }
      )

      // Expand
      const toggleButton = screen.getByRole("button")
      await fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByText(/Read more/i)).toBeInTheDocument()
      })
    })

    it("does not truncate short summaries", async () => {
      const shortSummary = "This is a short summary"

      mockQueryResult.mockResolvedValue({
        summary: shortSummary,
        isShared: false,
      })

      render(
        <SummaryPreview userNewsletterId={mockUserNewsletterId} />,
        { wrapper: createWrapper() }
      )

      // Expand
      const toggleButton = screen.getByRole("button")
      await fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByText(shortSummary)).toBeInTheDocument()
        expect(screen.queryByText(/Read more/i)).not.toBeInTheDocument()
      })
    })
  })

  describe("Community Summary Indicator", () => {
    it("shows community indicator for shared summaries", async () => {
      mockQueryResult.mockResolvedValue({
        summary: "A shared community summary",
        isShared: true,
      })

      render(
        <SummaryPreview userNewsletterId={mockUserNewsletterId} />,
        { wrapper: createWrapper() }
      )

      // Expand
      const toggleButton = screen.getByRole("button")
      await fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByText("Community")).toBeInTheDocument()
      })
    })

    it("does not show community indicator for personal summaries", async () => {
      mockQueryResult.mockResolvedValue({
        summary: "A personal summary",
        isShared: false,
      })

      render(
        <SummaryPreview userNewsletterId={mockUserNewsletterId} />,
        { wrapper: createWrapper() }
      )

      // Expand
      const toggleButton = screen.getByRole("button")
      await fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByText("A personal summary")).toBeInTheDocument()
        expect(screen.queryByText("Community")).not.toBeInTheDocument()
      })
    })
  })

  describe("Empty State", () => {
    it("shows message when no summary available", async () => {
      mockQueryResult.mockResolvedValue({
        summary: null,
        isShared: false,
      })

      render(
        <SummaryPreview userNewsletterId={mockUserNewsletterId} />,
        { wrapper: createWrapper() }
      )

      // Expand
      const toggleButton = screen.getByRole("button")
      await fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByText(/No summary available/i)).toBeInTheDocument()
      })
    })
  })

  describe("Event Propagation", () => {
    it("stops click propagation on toggle button", async () => {
      const parentClickHandler = vi.fn()

      render(
        <div onClick={parentClickHandler}>
          <SummaryPreview userNewsletterId={mockUserNewsletterId} />
        </div>,
        { wrapper: createWrapper() }
      )

      const toggleButton = screen.getByRole("button")
      await fireEvent.click(toggleButton)

      // Parent should not receive the click
      expect(parentClickHandler).not.toHaveBeenCalled()
    })
  })
})
