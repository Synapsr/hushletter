import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DeliveryDetailPanel } from "./DeliveryDetailPanel"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"

// Mock the mutation hook
const mockMutate = vi.fn()
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

vi.mock("@convex-dev/react-query", () => ({
  useConvexMutation: () => vi.fn(),
}))

/**
 * Tests for DeliveryDetailPanel component
 * Story 7.2: Task 5.1 - Expandable row details
 */

const createMockLog = (overrides = {}) => ({
  _id: "log123" as Id<"emailDeliveryLogs">,
  recipientEmail: "user@test.com",
  senderEmail: "newsletter@example.com",
  senderName: "Example Newsletter",
  subject: "Test Newsletter Subject",
  messageId: "msg123@example.com",
  status: "stored" as const,
  receivedAt: Date.now() - 3600000,
  processingStartedAt: Date.now() - 3500000,
  completedAt: Date.now() - 3400000,
  retryCount: 0,
  isAcknowledged: false,
  ...overrides,
})

describe("DeliveryDetailPanel", () => {
  beforeEach(() => {
    mockMutate.mockClear()
  })

  it("renders email details", () => {
    const log = createMockLog()

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.getByText("Message ID")).toBeInTheDocument()
    expect(screen.getByText("msg123@example.com")).toBeInTheDocument()
    expect(screen.getByText("Recipient")).toBeInTheDocument()
    expect(screen.getByText("user@test.com")).toBeInTheDocument()
    expect(screen.getByText("Sender")).toBeInTheDocument()
    expect(screen.getByText("Example Newsletter <newsletter@example.com>")).toBeInTheDocument()
    expect(screen.getByText("Test Newsletter Subject")).toBeInTheDocument()
  })

  it("renders sender email only when no sender name", () => {
    const log = createMockLog({ senderName: undefined })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.getByText("newsletter@example.com")).toBeInTheDocument()
  })

  it("renders processing timeline", () => {
    const log = createMockLog()

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.getByText("Processing Timeline")).toBeInTheDocument()
    expect(screen.getByText(/Received:/)).toBeInTheDocument()
    expect(screen.getByText(/Processing started:/)).toBeInTheDocument()
    expect(screen.getByText(/Completed:/)).toBeInTheDocument()
  })

  it("does not show processing started if not available", () => {
    const log = createMockLog({ processingStartedAt: undefined })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.queryByText(/Processing started:/)).not.toBeInTheDocument()
  })

  it("does not show completed if not available", () => {
    const log = createMockLog({ completedAt: undefined })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.queryByText(/Completed:/)).not.toBeInTheDocument()
  })

  it("renders content info when available", () => {
    const log = createMockLog({
      contentSizeBytes: 10240, // 10 KB
      hasHtmlContent: true,
      hasPlainTextContent: false,
    })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.getByText("Content Info")).toBeInTheDocument()
    expect(screen.getByText("10 KB")).toBeInTheDocument()
    expect(screen.getByText("HTML")).toBeInTheDocument()
  })

  it("does not render content info when not available", () => {
    const log = createMockLog({
      contentSizeBytes: undefined,
      hasHtmlContent: undefined,
      hasPlainTextContent: undefined,
    })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.queryByText("Content Info")).not.toBeInTheDocument()
  })

  it("renders error details for failed status", () => {
    const log = createMockLog({
      status: "failed",
      errorCode: "PARSE_ERROR",
      errorMessage: "Failed to parse email content",
    })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.getByText("Error Details")).toBeInTheDocument()
    expect(screen.getByText("PARSE_ERROR")).toBeInTheDocument()
    expect(screen.getByText("Failed to parse email content")).toBeInTheDocument()
  })

  it("does not render error details for non-failed status", () => {
    const log = createMockLog({ status: "stored" })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.queryByText("Error Details")).not.toBeInTheDocument()
  })

  it("renders Acknowledge button for unacknowledged failed delivery", () => {
    const log = createMockLog({
      status: "failed",
      isAcknowledged: false,
    })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.getByText("Acknowledge")).toBeInTheDocument()
  })

  it("renders Acknowledged badge for acknowledged failed delivery", () => {
    const log = createMockLog({
      status: "failed",
      isAcknowledged: true,
    })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.getByText("Acknowledged")).toBeInTheDocument()
    expect(screen.queryByText("Acknowledge")).not.toBeInTheDocument()
  })

  it("calls mutation when acknowledge button is clicked", () => {
    const log = createMockLog({
      status: "failed",
      isAcknowledged: false,
    })

    render(<DeliveryDetailPanel log={log} />)

    fireEvent.click(screen.getByText("Acknowledge"))

    expect(mockMutate).toHaveBeenCalledWith({ logId: "log123" })
  })

  it("renders user ID when available", () => {
    const log = createMockLog({
      userId: "user456" as Id<"users">,
    })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.getByText(/User ID:/)).toBeInTheDocument()
    expect(screen.getByText("user456")).toBeInTheDocument()
  })

  it("does not render user ID when not available", () => {
    const log = createMockLog({ userId: undefined })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.queryByText(/User ID:/)).not.toBeInTheDocument()
  })

  it("renders retry count when greater than zero", () => {
    const log = createMockLog({ retryCount: 3 })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.getByText(/Retry attempts:/)).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("does not render retry count when zero", () => {
    const log = createMockLog({ retryCount: 0 })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.queryByText(/Retry attempts:/)).not.toBeInTheDocument()
  })

  it("shows Unknown error when error message is empty", () => {
    const log = createMockLog({
      status: "failed",
      errorMessage: undefined,
    })

    render(<DeliveryDetailPanel log={log} />)

    expect(screen.getByText("Unknown error")).toBeInTheDocument()
  })
})
