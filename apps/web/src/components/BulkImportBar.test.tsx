import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BulkImportBar } from "./BulkImportBar"
import type { Id } from "@newsletter-manager/backend/convex/_generated/dataModel"
import { toast } from "sonner"

/**
 * BulkImportBar Tests - Story 9.9 Task 7.9
 *
 * Tests for the bulk import floating action bar component.
 */

// Mock Convex hooks
const mockBulkImport = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: () => mockBulkImport,
}))

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

describe("BulkImportBar (Story 9.9)", () => {
  const mockOnClearSelection = vi.fn()
  const mockOnImportComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockBulkImport.mockResolvedValue({
      imported: 5,
      skipped: 0,
      failed: 0,
      total: 5,
      results: [],
    })
  })

  it("renders only when items are selected", () => {
    const emptySet = new Set<Id<"newsletterContent">>()
    const { container } = render(
      <BulkImportBar
        selectedIds={emptySet}
        onClearSelection={mockOnClearSelection}
        onImportComplete={mockOnImportComplete}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("shows selected count correctly", () => {
    const selectedIds = new Set([
      "content1" as Id<"newsletterContent">,
      "content2" as Id<"newsletterContent">,
      "content3" as Id<"newsletterContent">,
    ])
    render(
      <BulkImportBar
        selectedIds={selectedIds}
        onClearSelection={mockOnClearSelection}
        onImportComplete={mockOnImportComplete}
      />
    )
    expect(screen.getByText("3 selected")).toBeInTheDocument()
  })

  it("calls bulkImportFromCommunity on Import Selected click", async () => {
    const user = userEvent.setup()
    const selectedIds = new Set([
      "content1" as Id<"newsletterContent">,
      "content2" as Id<"newsletterContent">,
    ])
    render(
      <BulkImportBar
        selectedIds={selectedIds}
        onClearSelection={mockOnClearSelection}
        onImportComplete={mockOnImportComplete}
      />
    )

    const importButton = screen.getByRole("button", { name: /import selected/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(mockBulkImport).toHaveBeenCalledWith({
        contentIds: expect.arrayContaining(["content1", "content2"]),
      })
    })
  })

  it("clears selection on complete", async () => {
    const user = userEvent.setup()
    const selectedIds = new Set(["content1" as Id<"newsletterContent">])
    render(
      <BulkImportBar
        selectedIds={selectedIds}
        onClearSelection={mockOnClearSelection}
        onImportComplete={mockOnImportComplete}
      />
    )

    const importButton = screen.getByRole("button", { name: /import selected/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(mockOnClearSelection).toHaveBeenCalled()
      expect(mockOnImportComplete).toHaveBeenCalled()
    })
  })

  it("clears selection on X button click", async () => {
    const user = userEvent.setup()
    const selectedIds = new Set(["content1" as Id<"newsletterContent">])
    render(
      <BulkImportBar
        selectedIds={selectedIds}
        onClearSelection={mockOnClearSelection}
        onImportComplete={mockOnImportComplete}
      />
    )

    const clearButton = screen.getByRole("button", { name: /clear selection/i })
    await user.click(clearButton)

    expect(mockOnClearSelection).toHaveBeenCalled()
  })

  it("shows Import Selected button with correct text", () => {
    const selectedIds = new Set(["content1" as Id<"newsletterContent">])
    render(
      <BulkImportBar
        selectedIds={selectedIds}
        onClearSelection={mockOnClearSelection}
        onImportComplete={mockOnImportComplete}
      />
    )

    expect(screen.getByRole("button", { name: /import selected/i })).toBeInTheDocument()
  })

  it("shows error toast when bulk import fails", async () => {
    mockBulkImport.mockRejectedValueOnce(new Error("Network error"))
    const user = userEvent.setup()
    const selectedIds = new Set(["content1" as Id<"newsletterContent">])
    render(
      <BulkImportBar
        selectedIds={selectedIds}
        onClearSelection={mockOnClearSelection}
        onImportComplete={mockOnImportComplete}
      />
    )

    const importButton = screen.getByRole("button", { name: /import selected/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Bulk import failed")
    })
  })

  it("shows loading state with item count during import", async () => {
    // Create a promise we can control to keep the import "in progress"
    let resolveImport: (value: unknown) => void
    mockBulkImport.mockImplementation(() => new Promise((resolve) => {
      resolveImport = resolve
    }))

    const user = userEvent.setup()
    const selectedIds = new Set([
      "content1" as Id<"newsletterContent">,
      "content2" as Id<"newsletterContent">,
    ])
    render(
      <BulkImportBar
        selectedIds={selectedIds}
        onClearSelection={mockOnClearSelection}
        onImportComplete={mockOnImportComplete}
      />
    )

    const importButton = screen.getByRole("button", { name: /import selected/i })
    await user.click(importButton)

    // Should show loading text with count
    await waitFor(() => {
      expect(screen.getByText(/importing 2 newsletters/i)).toBeInTheDocument()
    })

    // Cleanup: resolve the promise
    resolveImport!({ imported: 2, skipped: 0, failed: 0, total: 2, results: [] })
  })
})
