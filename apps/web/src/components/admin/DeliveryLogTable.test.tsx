import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DeliveryLogTable } from "./DeliveryLogTable"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"

// Mock the child components
vi.mock("./DeliveryStatusBadge", () => ({
  DeliveryStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}))

vi.mock("./DeliveryDetailPanel", () => ({
  DeliveryDetailPanel: () => <div data-testid="detail-panel">Detail Panel</div>,
}))

/**
 * Tests for DeliveryLogTable component
 * Story 7.2: Task 4.3 - Paginated log table with filters
 */

const createMockLog = (overrides = {}) => ({
  _id: "log123" as Id<"emailDeliveryLogs">,
  recipientEmail: "user@test.com",
  senderEmail: "newsletter@example.com",
  senderName: "Example Newsletter",
  subject: "Test Newsletter Subject",
  messageId: "msg123@example.com",
  status: "stored" as const,
  receivedAt: Date.now() - 3600000, // 1 hour ago
  retryCount: 0,
  isAcknowledged: false,
  ...overrides,
})

describe("DeliveryLogTable", () => {
  it("renders empty state when no logs", () => {
    render(<DeliveryLogTable logs={[]} hasMore={false} />)

    expect(screen.getByText("No delivery logs found")).toBeInTheDocument()
  })

  it("renders table with log entries", () => {
    const logs = [createMockLog()]

    render(<DeliveryLogTable logs={logs} hasMore={false} />)

    expect(screen.getByText("Test Newsletter Subject")).toBeInTheDocument()
    expect(screen.getByText("Example Newsletter")).toBeInTheDocument()
    expect(screen.getByText("user@test.com")).toBeInTheDocument()
  })

  it("renders table headers", () => {
    const logs = [createMockLog()]

    render(<DeliveryLogTable logs={logs} hasMore={false} />)

    expect(screen.getByText("Subject")).toBeInTheDocument()
    expect(screen.getByText("Sender")).toBeInTheDocument()
    expect(screen.getByText("Recipient")).toBeInTheDocument()
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("Received")).toBeInTheDocument()
  })

  it("shows sender email when sender name is not available", () => {
    const logs = [createMockLog({ senderName: undefined })]

    render(<DeliveryLogTable logs={logs} hasMore={false} />)

    expect(screen.getByText("newsletter@example.com")).toBeInTheDocument()
  })

  it("shows status badge for each log", () => {
    const logs = [createMockLog()]

    render(<DeliveryLogTable logs={logs} hasMore={false} />)

    expect(screen.getByTestId("status-badge")).toHaveTextContent("stored")
  })

  it("expands row on click to show detail panel", () => {
    const logs = [createMockLog()]

    render(<DeliveryLogTable logs={logs} hasMore={false} />)

    // Initially, detail panel should not be visible
    expect(screen.queryByTestId("detail-panel")).not.toBeInTheDocument()

    // Click on the row
    fireEvent.click(screen.getByText("Test Newsletter Subject"))

    // Detail panel should now be visible
    expect(screen.getByTestId("detail-panel")).toBeInTheDocument()
  })

  it("collapses row on second click", () => {
    const logs = [createMockLog()]

    render(<DeliveryLogTable logs={logs} hasMore={false} />)

    // Click to expand
    fireEvent.click(screen.getByText("Test Newsletter Subject"))
    expect(screen.getByTestId("detail-panel")).toBeInTheDocument()

    // Click again to collapse
    fireEvent.click(screen.getByText("Test Newsletter Subject"))
    expect(screen.queryByTestId("detail-panel")).not.toBeInTheDocument()
  })

  it("shows pagination hint when hasMore is true", () => {
    const logs = [createMockLog()]

    render(<DeliveryLogTable logs={logs} hasMore={true} />)

    expect(screen.getByText(/Showing first 50 results/)).toBeInTheDocument()
  })

  it("hides pagination hint when hasMore is false", () => {
    const logs = [createMockLog()]

    render(<DeliveryLogTable logs={logs} hasMore={false} />)

    expect(screen.queryByText(/Showing first 50 results/)).not.toBeInTheDocument()
  })

  it("highlights failed rows with red background", () => {
    const logs = [createMockLog({ status: "failed" })]

    const { container } = render(<DeliveryLogTable logs={logs} hasMore={false} />)

    // Check for red background class
    const row = container.querySelector('[class*="bg-red"]')
    expect(row).toBeInTheDocument()
  })

  it("renders multiple logs correctly", () => {
    const logs = [
      createMockLog({ _id: "log1" as Id<"emailDeliveryLogs">, subject: "Newsletter 1" }),
      createMockLog({ _id: "log2" as Id<"emailDeliveryLogs">, subject: "Newsletter 2" }),
      createMockLog({ _id: "log3" as Id<"emailDeliveryLogs">, subject: "Newsletter 3" }),
    ]

    render(<DeliveryLogTable logs={logs} hasMore={false} />)

    expect(screen.getByText("Newsletter 1")).toBeInTheDocument()
    expect(screen.getByText("Newsletter 2")).toBeInTheDocument()
    expect(screen.getByText("Newsletter 3")).toBeInTheDocument()
  })

  it("only expands one row at a time", () => {
    const logs = [
      createMockLog({ _id: "log1" as Id<"emailDeliveryLogs">, subject: "Newsletter 1" }),
      createMockLog({ _id: "log2" as Id<"emailDeliveryLogs">, subject: "Newsletter 2" }),
    ]

    render(<DeliveryLogTable logs={logs} hasMore={false} />)

    // Expand first row
    fireEvent.click(screen.getByText("Newsletter 1"))
    expect(screen.getAllByTestId("detail-panel")).toHaveLength(1)

    // Expand second row (should collapse first)
    fireEvent.click(screen.getByText("Newsletter 2"))
    expect(screen.getAllByTestId("detail-panel")).toHaveLength(1)
  })

  it("has accessible expand/collapse buttons", () => {
    const logs = [createMockLog()]

    render(<DeliveryLogTable logs={logs} hasMore={false} />)

    const expandButton = screen.getByLabelText("Expand row")
    expect(expandButton).toBeInTheDocument()

    // Click to expand
    fireEvent.click(expandButton)

    const collapseButton = screen.getByLabelText("Collapse row")
    expect(collapseButton).toBeInTheDocument()
  })
})
