import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"
import { SummaryPanel } from "./SummaryPanel"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * Tests for SummaryPanel component - Story 5.1: Task 7
 *
 * Tests cover:
 * - Task 7.12: Loading state rendering
 * - Task 7.13: Displays "Community summary" badge for shared
 * - Task 7.14: Regenerate calls with forceRegenerate=true
 * - Task 7.15: Error state rendering
 * - Task 7.16: Reader view integration (summary visible)
 */

// Mock Convex hooks
const mockGenerateSummary = vi.fn()
const mockSummaryData = vi.fn()
let mockIsPro = true

vi.mock("convex/react", () => ({
  useAction: () => mockGenerateSummary,
}))

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query")
  return {
    ...actual,
    useQuery: (options: any) => {
      const queryKey = options?.queryKey as unknown[] | undefined
      const apiFn = queryKey?.[0]

      if (apiFn === "getEntitlements") {
        return {
          data: { isPro: mockIsPro },
          isPending: false,
          error: null,
        }
      }

      return {
        data: mockSummaryData(),
        isPending: false,
        error: null,
      }
    },
  }
})

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: (api: unknown, args: unknown) => ({ queryKey: [api, args] }),
}))

vi.mock("@hushletter/backend", () => ({
  api: {
    entitlements: {
      getEntitlements: "getEntitlements",
    },
    ai: {
      getNewsletterSummary: "getNewsletterSummary",
      generateSummary: "generateSummary",
    },
  },
}))

vi.mock("@/components/pricing-dialog", () => ({
  PricingDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="pricing-dialog-mock">Pricing dialog</div> : null,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("SummaryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateSummary.mockReset()
    mockSummaryData.mockReset()
    mockIsPro = true
    try {
      localStorage.removeItem("hushletter:summary-collapsed")
    } catch {
      // ignore
    }
  })

  describe("Empty State (No Summary)", () => {
    beforeEach(() => {
      mockSummaryData.mockReturnValue({
        summary: null,
        isShared: false,
        generatedAt: null,
      })
    })

    it("shows guidance text when no summary exists (Task 5.2)", () => {
      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      expect(
        screen.getByText(/Generate an AI summary to quickly understand/i)
      ).toBeInTheDocument()
    })

    it("shows 'Summarize' button when no summary exists (Task 5.2)", () => {
      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByRole("button", { name: /Summarize/i })).toBeInTheDocument()
    })

    it("does not show collapse button when no summary (Task 5.5)", () => {
      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      expect(
        screen.queryByRole("button", { name: /Expand summary|Collapse summary/i })
      ).not.toBeInTheDocument()
    })
  })

  it("opens shared pricing dialog for non-pro users", () => {
    mockIsPro = false
    mockSummaryData.mockReturnValue({
      summary: null,
      isShared: false,
      generatedAt: null,
    })

    render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
      wrapper: createWrapper(),
    })

    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }))
    expect(screen.getByTestId("pricing-dialog-mock")).toBeInTheDocument()
  })

  describe("Summary Display (Task 5.4)", () => {
    beforeEach(() => {
      mockSummaryData.mockReturnValue({
        summary: "This newsletter covers key points about testing.",
        isShared: false,
        generatedAt: Date.now(),
      })
    })

    it("displays summary content when available (Task 5.4)", () => {
      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      expect(
        screen.getByText(/This newsletter covers key points about testing/i)
      ).toBeInTheDocument()
    })

    it("shows 'Regenerate' button when summary exists (Task 5.5)", () => {
      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByRole("button", { name: /Regenerate/i })).toBeInTheDocument()
    })

    it("shows collapse button when summary exists", () => {
      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      expect(
        screen.getByRole("button", { name: /Collapse summary/i })
      ).toBeInTheDocument()
    })

    it("does not show empty state guidance when summary exists", () => {
      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      expect(
        screen.queryByText(/Generate an AI summary to quickly understand/i)
      ).not.toBeInTheDocument()
    })
  })

  describe("Community Summary Badge (Task 7.13)", () => {
    it("shows 'Community summary' badge for shared summaries (isShared=true)", () => {
      mockSummaryData.mockReturnValue({
        summary: "Shared summary content from first user",
        isShared: true,
        generatedAt: Date.now(),
      })

      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText("Community summary")).toBeInTheDocument()
    })

    it("does not show community badge for personal summaries (isShared=false)", () => {
      mockSummaryData.mockReturnValue({
        summary: "Personal summary after regeneration",
        isShared: false,
        generatedAt: Date.now(),
      })

      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      expect(screen.queryByText("Community summary")).not.toBeInTheDocument()
    })
  })

  describe("Loading State (Task 7.12)", () => {
    beforeEach(() => {
      mockSummaryData.mockReturnValue({
        summary: null,
        isShared: false,
        generatedAt: null,
      })
    })

    it("shows skeleton loader while generating (Task 5.3)", async () => {
      // Make generateSummary hang to simulate loading
      mockGenerateSummary.mockImplementation(() => new Promise(() => {}))

      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      // Click Summarize button
      fireEvent.click(screen.getByRole("button", { name: /Summarize/i }))

      // Should show animated skeleton
      await waitFor(() => {
        expect(document.querySelector(".animate-pulse")).toBeInTheDocument()
      })
    })
  })

  describe("Generate/Regenerate Actions (Task 7.14)", () => {
    it("calls generateSummary with forceRegenerate=false for first generation", async () => {
      mockSummaryData.mockReturnValue({
        summary: null,
        isShared: false,
        generatedAt: null,
      })
      mockGenerateSummary.mockResolvedValue({ summary: "New summary" })

      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      fireEvent.click(screen.getByRole("button", { name: /Summarize/i }))

      await waitFor(() => {
        expect(mockGenerateSummary).toHaveBeenCalledWith({
          userNewsletterId: "test-id",
          forceRegenerate: false,
        })
      })
    })

    it("calls generateSummary with forceRegenerate=true for regeneration (Task 7.14)", async () => {
      mockSummaryData.mockReturnValue({
        summary: "Existing summary",
        isShared: true,
        generatedAt: Date.now(),
      })
      mockGenerateSummary.mockResolvedValue({ summary: "Regenerated summary" })

      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      fireEvent.click(screen.getByRole("button", { name: /Regenerate/i }))

      await waitFor(() => {
        expect(mockGenerateSummary).toHaveBeenCalledWith({
          userNewsletterId: "test-id",
          forceRegenerate: true,
        })
      })
    })
  })

  describe("Error State (Task 7.15)", () => {
    beforeEach(() => {
      mockSummaryData.mockReturnValue({
        summary: null,
        isShared: false,
        generatedAt: null,
      })
    })

    it("shows error message when generation fails (Task 5.6)", async () => {
      const errorMessage = "AI service is temporarily unavailable"
      mockGenerateSummary.mockRejectedValue({
        data: { message: errorMessage, code: "AI_UNAVAILABLE" },
      })

      // Mock ConvexError check
      vi.mock("convex/values", () => ({
        ConvexError: class ConvexError extends Error {
          data: unknown
          constructor(data: unknown) {
            super()
            this.data = data
          }
        },
      }))

      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      fireEvent.click(screen.getByRole("button", { name: /Summarize/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to generate summary/i)
        ).toBeInTheDocument()
      })
    })

    it("error state has alert role for accessibility", async () => {
      mockGenerateSummary.mockRejectedValue(new Error("Network error"))

      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      fireEvent.click(screen.getByRole("button", { name: /Summarize/i }))

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })
    })
  })

  describe("Collapse/Expand (Collapsible per UX spec)", () => {
    beforeEach(() => {
      mockSummaryData.mockReturnValue({
        summary: "Summary content that can be collapsed",
        isShared: false,
        generatedAt: Date.now(),
      })
    })

    it("can collapse summary content", async () => {
      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      // Summary should be visible initially
      expect(
        screen.getByText(/Summary content that can be collapsed/i)
      ).toBeInTheDocument()

      // Click collapse button
      fireEvent.click(screen.getByRole("button", { name: /Collapse summary/i }))

      // Summary should be hidden
      await waitFor(() => {
        expect(
          screen.queryByText(/Summary content that can be collapsed/i)
        ).not.toBeInTheDocument()
      })
    })

    it("can expand collapsed summary", async () => {
      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      // Collapse first
      fireEvent.click(screen.getByRole("button", { name: /Collapse summary/i }))

      // Should show expand button
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Expand summary/i })
        ).toBeInTheDocument()
      })

      // Expand
      fireEvent.click(screen.getByRole("button", { name: /Expand summary/i }))

      // Summary should be visible again
      await waitFor(() => {
        expect(
          screen.getByText(/Summary content that can be collapsed/i)
        ).toBeInTheDocument()
      })
    })

    it("has proper aria-expanded attribute for accessibility", () => {
      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      const collapseButton = screen.getByRole("button", {
        name: /Collapse summary/i,
      })
      expect(collapseButton).toHaveAttribute("aria-expanded", "true")

      fireEvent.click(collapseButton)

      const expandButton = screen.getByRole("button", { name: /Expand summary/i })
      expect(expandButton).toHaveAttribute("aria-expanded", "false")
    })
  })

  describe("AI Summary Title", () => {
    it("shows 'AI Summary' title in card header", () => {
      mockSummaryData.mockReturnValue({
        summary: null,
        isShared: false,
        generatedAt: null,
      })

      render(<SummaryPanel userNewsletterId={"test-id" as Id<"userNewsletters">} />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText("AI Summary")).toBeInTheDocument()
    })
  })
})
