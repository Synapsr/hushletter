/**
 * SenderReview Component Tests
 * Story 4.3: Task 6 - Write Tests (All ACs)
 *
 * Code Review Fixes Applied:
 * - Updated tests for optimistic updates behavior
 * - Added tests for error handling UI
 * - Added tests for detected date display
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SenderReview } from "./-SenderReview"

// Mock Convex react hooks
const mockUseQuery = vi.fn()
const mockUseMutation = vi.fn()

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}))

// Mock the api module
vi.mock("@hushletter/backend", () => ({
  api: {
    gmail: {
      getDetectedSenders: "getDetectedSenders",
      getSelectedSendersCount: "getSelectedSendersCount",
      updateSenderSelection: "updateSenderSelection",
      selectAllSenders: "selectAllSenders",
      deselectAllSenders: "deselectAllSenders",
      approveSelectedSenders: "approveSelectedSenders",
    },
  },
}))

// Sample test data with detectedAt timestamp
const mockSenders = [
  {
    _id: "sender1",
    email: "newsletter@example.com",
    name: "Example Newsletter",
    domain: "example.com",
    emailCount: 25,
    confidenceScore: 85,
    sampleSubjects: ["Weekly Update #1", "Weekly Update #2"],
    detectedAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
    isSelected: true,
    isApproved: false,
  },
  {
    _id: "sender2",
    email: "digest@news.com",
    name: "News Digest",
    domain: "news.com",
    emailCount: 12,
    confidenceScore: 60,
    sampleSubjects: ["Daily News"],
    detectedAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
    isSelected: true,
    isApproved: false,
  },
  {
    _id: "sender3",
    email: "promo@spam.com",
    name: undefined,
    domain: "spam.com",
    emailCount: 5,
    confidenceScore: 30,
    sampleSubjects: [],
    detectedAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
    isSelected: false,
    isApproved: false,
  },
]

// Mock mutation functions
const mockUpdateSelection = vi.fn()
const mockSelectAll = vi.fn()
const mockDeselectAll = vi.fn()
const mockApproveSelected = vi.fn()

describe("SenderReview", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    mockUseQuery.mockImplementation((queryRef: string) => {
      if (queryRef === "getDetectedSenders") {
        return mockSenders
      }
      if (queryRef === "getSelectedSendersCount") {
        return { selectedCount: 2, totalCount: 3 }
      }
      return undefined
    })

    mockUseMutation.mockImplementation((mutationRef: string) => {
      if (mutationRef === "updateSenderSelection") {
        return mockUpdateSelection
      }
      if (mutationRef === "selectAllSenders") {
        return mockSelectAll
      }
      if (mutationRef === "deselectAllSenders") {
        return mockDeselectAll
      }
      if (mutationRef === "approveSelectedSenders") {
        return mockApproveSelected
      }
      return vi.fn()
    })

    // Default: mutations resolve successfully
    mockUpdateSelection.mockResolvedValue(undefined)
    mockSelectAll.mockResolvedValue({ updatedCount: 1 })
    mockDeselectAll.mockResolvedValue({ updatedCount: 2 })
    mockApproveSelected.mockResolvedValue({ approvedCount: 2 })
  })

  describe("AC#1: Default Selection", () => {
    it("renders each sender with a checkbox", () => {
      render(<SenderReview />)

      // Check that each sender is rendered
      expect(screen.getByText("Example Newsletter")).toBeInTheDocument()
      expect(screen.getByText("News Digest")).toBeInTheDocument()
      expect(screen.getByText("promo@spam.com")).toBeInTheDocument() // No name, shows email

      // Check checkboxes exist
      const checkboxes = screen.getAllByRole("checkbox")
      expect(checkboxes).toHaveLength(3)
    })

    it("shows correct count of selected senders", () => {
      render(<SenderReview />)

      expect(
        screen.getByText("2 of 3 senders selected for import")
      ).toBeInTheDocument()
    })

    it("senders are selected by default (isSelected: true shown as checked)", () => {
      render(<SenderReview />)

      const checkboxes = screen.getAllByRole("checkbox")

      // First two senders are selected
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).toBeChecked()
      // Third sender is not selected
      expect(checkboxes[2]).not.toBeChecked()
    })
  })

  describe("AC#2: Select All / Deselect All", () => {
    it("Select All button calls selectAllSenders mutation", async () => {
      const user = userEvent.setup()
      render(<SenderReview />)

      const selectAllButton = screen.getByRole("button", { name: /^select all$/i })
      await user.click(selectAllButton)

      expect(mockSelectAll).toHaveBeenCalled()
    })

    it("Deselect All button calls deselectAllSenders mutation", async () => {
      const user = userEvent.setup()
      render(<SenderReview />)

      const deselectAllButton = screen.getByRole("button", {
        name: /^deselect all$/i,
      })
      await user.click(deselectAllButton)

      expect(mockDeselectAll).toHaveBeenCalled()
    })

    it("Select All button is disabled when all are selected", () => {
      mockUseQuery.mockImplementation((queryRef: string) => {
        if (queryRef === "getDetectedSenders") {
          return mockSenders
        }
        if (queryRef === "getSelectedSendersCount") {
          return { selectedCount: 3, totalCount: 3 } // All selected
        }
        return undefined
      })

      render(<SenderReview />)

      const selectAllButton = screen.getByRole("button", { name: /^select all$/i })
      expect(selectAllButton).toBeDisabled()
    })

    it("Deselect All button is disabled when none are selected", () => {
      mockUseQuery.mockImplementation((queryRef: string) => {
        if (queryRef === "getDetectedSenders") {
          return mockSenders
        }
        if (queryRef === "getSelectedSendersCount") {
          return { selectedCount: 0, totalCount: 3 } // None selected
        }
        return undefined
      })

      render(<SenderReview />)

      const deselectAllButton = screen.getByRole("button", {
        name: /^deselect all$/i,
      })
      expect(deselectAllButton).toBeDisabled()
    })
  })

  describe("AC#3: Sender Detail View", () => {
    it("clicking sender row expands detail view", async () => {
      const user = userEvent.setup()
      render(<SenderReview />)

      // Sample subjects should not be visible initially
      expect(screen.queryByText("Weekly Update #1")).not.toBeInTheDocument()

      // Click on the first sender row
      const senderRow = screen.getByText("Example Newsletter").closest("div[role='button']")
      expect(senderRow).toBeInTheDocument()

      if (senderRow) {
        await user.click(senderRow)
      }

      // Now sample subjects should be visible
      expect(screen.getByText("Weekly Update #1")).toBeInTheDocument()
    })

    it("detail shows sample subjects", async () => {
      const user = userEvent.setup()
      render(<SenderReview />)

      // Click to expand
      const senderRow = screen.getByText("Example Newsletter").closest("div[role='button']")
      if (senderRow) {
        await user.click(senderRow)
      }

      expect(screen.getByText("Sample subjects:")).toBeInTheDocument()
      expect(screen.getByText("Weekly Update #1")).toBeInTheDocument()
      expect(screen.getByText("Weekly Update #2")).toBeInTheDocument()
    })

    it("detail shows confidence score and domain", async () => {
      const user = userEvent.setup()
      render(<SenderReview />)

      // Click to expand
      const senderRow = screen.getByText("Example Newsletter").closest("div[role='button']")
      if (senderRow) {
        await user.click(senderRow)
      }

      expect(screen.getByText("Domain:")).toBeInTheDocument()
      expect(screen.getByText("example.com")).toBeInTheDocument()
      expect(screen.getByText("Confidence:")).toBeInTheDocument()
    })

    it("detail shows detected date", async () => {
      const user = userEvent.setup()
      render(<SenderReview />)

      // Click to expand
      const senderRow = screen.getByText("Example Newsletter").closest("div[role='button']")
      if (senderRow) {
        await user.click(senderRow)
      }

      expect(screen.getByText("Detected:")).toBeInTheDocument()
    })

    it("clicking again collapses detail", async () => {
      const user = userEvent.setup()
      render(<SenderReview />)

      const senderRow = screen.getByText("Example Newsletter").closest("div[role='button']")

      // First click - expand
      if (senderRow) {
        await user.click(senderRow)
      }
      expect(screen.getByText("Weekly Update #1")).toBeInTheDocument()

      // Second click - collapse
      if (senderRow) {
        await user.click(senderRow)
      }
      expect(screen.queryByText("Weekly Update #1")).not.toBeInTheDocument()
    })
  })

  describe("AC#4: Import Trigger", () => {
    it("Import button shows count of selected senders", () => {
      render(<SenderReview />)

      expect(
        screen.getByRole("button", { name: /import 2 senders/i })
      ).toBeInTheDocument()
    })

    it("Import button is disabled when 0 selected", () => {
      mockUseQuery.mockImplementation((queryRef: string) => {
        if (queryRef === "getDetectedSenders") {
          return mockSenders
        }
        if (queryRef === "getSelectedSendersCount") {
          return { selectedCount: 0, totalCount: 3 }
        }
        return undefined
      })

      render(<SenderReview />)

      const importButton = screen.getByRole("button", { name: /import 0 senders/i })
      expect(importButton).toBeDisabled()
    })

    it("clicking Import shows confirmation view", async () => {
      const user = userEvent.setup()
      render(<SenderReview />)

      const importButton = screen.getByRole("button", { name: /import 2 senders/i })
      await user.click(importButton)

      // Should show confirmation view - check for the descriptive text
      expect(
        screen.getByText(/you're about to import newsletters from 2 senders/i)
      ).toBeInTheDocument()
      // Check for Go Back button which only appears in confirm view
      expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument()
    })

    it("confirming import calls approveSelectedSenders mutation", async () => {
      const user = userEvent.setup()
      render(<SenderReview />)

      // Go to confirm view
      const importButton = screen.getByRole("button", { name: /import 2 senders/i })
      await user.click(importButton)

      // Click confirm
      const confirmButton = screen.getByRole("button", { name: /confirm import/i })
      await user.click(confirmButton)

      expect(mockApproveSelected).toHaveBeenCalled()
    })

    it("shows success view after approval", async () => {
      const user = userEvent.setup()
      render(<SenderReview />)

      // Go to confirm view
      const importButton = screen.getByRole("button", { name: /import 2 senders/i })
      await user.click(importButton)

      // Click confirm
      const confirmButton = screen.getByRole("button", { name: /confirm import/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText("Senders Approved!")).toBeInTheDocument()
        expect(
          screen.getByText(/2 senders approved for import/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe("AC#5: Visual Feedback", () => {
    it("deselected senders have muted styling (opacity)", () => {
      render(<SenderReview />)

      // The third sender is deselected
      // Check that it has the muted styling class
      const senderRows = document.querySelectorAll(".border.rounded-lg")
      expect(senderRows[2]).toHaveClass("opacity-60")
    })

    it("selected senders do not have muted styling", () => {
      render(<SenderReview />)

      const senderRows = document.querySelectorAll(".border.rounded-lg")
      expect(senderRows[0]).not.toHaveClass("opacity-60")
      expect(senderRows[1]).not.toHaveClass("opacity-60")
    })

    it("clicking checkbox updates selection state (optimistic update)", async () => {
      const user = userEvent.setup()
      render(<SenderReview />)

      const checkboxes = screen.getAllByRole("checkbox")
      await user.click(checkboxes[0])

      expect(mockUpdateSelection).toHaveBeenCalledWith({
        senderId: "sender1",
        isSelected: false,
      })
    })
  })

  describe("Error Handling", () => {
    it("shows error message when selection update fails", async () => {
      mockUpdateSelection.mockRejectedValue(new Error("Network error"))
      const user = userEvent.setup()
      render(<SenderReview />)

      const checkboxes = screen.getAllByRole("checkbox")
      await user.click(checkboxes[0])

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(
          screen.getByText(/failed to update selection/i)
        ).toBeInTheDocument()
      })
    })

    it("error can be dismissed", async () => {
      mockUpdateSelection.mockRejectedValue(new Error("Network error"))
      const user = userEvent.setup()
      render(<SenderReview />)

      const checkboxes = screen.getAllByRole("checkbox")
      await user.click(checkboxes[0])

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      })

      const dismissButton = screen.getByRole("button", { name: /dismiss/i })
      await user.click(dismissButton)

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    it("shows error when select all fails", async () => {
      mockSelectAll.mockRejectedValue(new Error("Server error"))
      const user = userEvent.setup()
      render(<SenderReview />)

      const selectAllButton = screen.getByRole("button", { name: /^select all$/i })
      await user.click(selectAllButton)

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(
          screen.getByText(/failed to select all senders/i)
        ).toBeInTheDocument()
      })
    })

    it("shows error when approval fails", async () => {
      mockApproveSelected.mockRejectedValue(new Error("Approval failed"))
      const user = userEvent.setup()
      render(<SenderReview />)

      // Go to confirm view
      const importButton = screen.getByRole("button", { name: /import 2 senders/i })
      await user.click(importButton)

      // Click confirm
      const confirmButton = screen.getByRole("button", { name: /confirm import/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
        expect(
          screen.getByText(/failed to approve senders/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe("Loading and Empty States", () => {
    it("shows loading skeleton when data is undefined", () => {
      mockUseQuery.mockReturnValue(undefined)

      render(<SenderReview />)

      // Should show loading skeleton (has animate-pulse class)
      const skeleton = document.querySelector(".animate-pulse")
      expect(skeleton).toBeInTheDocument()
    })

    it("shows empty state when no senders detected", () => {
      mockUseQuery.mockImplementation((queryRef: string) => {
        if (queryRef === "getDetectedSenders") {
          return []
        }
        if (queryRef === "getSelectedSendersCount") {
          return { selectedCount: 0, totalCount: 0 }
        }
        return undefined
      })

      render(<SenderReview />)

      expect(screen.getByText("No Senders to Review")).toBeInTheDocument()
    })
  })

  describe("Navigation", () => {
    it("calls onBack when Back button is clicked", async () => {
      const onBack = vi.fn()
      const user = userEvent.setup()
      render(<SenderReview onBack={onBack} />)

      const backButton = screen.getByRole("button", { name: /back/i })
      await user.click(backButton)

      expect(onBack).toHaveBeenCalled()
    })

    it("calls onStartImport when Done button is clicked after approval", async () => {
      const onStartImport = vi.fn()
      const user = userEvent.setup()
      render(<SenderReview onStartImport={onStartImport} />)

      // Go through the flow
      const importButton = screen.getByRole("button", { name: /import 2 senders/i })
      await user.click(importButton)

      const confirmButton = screen.getByRole("button", { name: /confirm import/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText("Senders Approved!")).toBeInTheDocument()
      })

      const doneButton = screen.getByRole("button", { name: /done/i })
      await user.click(doneButton)

      expect(onStartImport).toHaveBeenCalled()
    })
  })

  describe("Accessibility", () => {
    it("has aria-live region for count updates", () => {
      render(<SenderReview />)

      const description = screen.getByText(/2 of 3 senders selected for import/i)
      expect(description).toHaveAttribute("aria-live", "polite")
    })

    it("checkboxes have accessible labels", () => {
      render(<SenderReview />)

      expect(
        screen.getByRole("checkbox", { name: /select example newsletter for import/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("checkbox", { name: /select news digest for import/i })
      ).toBeInTheDocument()
    })

    it("sender rows have aria-expanded attribute", () => {
      render(<SenderReview />)

      const senderRow = screen.getByText("Example Newsletter").closest("div[role='button']")
      expect(senderRow).toHaveAttribute("aria-expanded", "false")
    })
  })
})
