/**
 * SenderScanner Component Tests
 * Story 4.2: Task 6.2 - Test SenderScanner component states
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SenderScanner } from "./-SenderScanner"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"

// Mock connection ID for testing
const mockConnectionId = "test_connection_id" as Id<"gmailConnections">;

// Track what queries return - accessible via globalThis for hoisted mocks
let scanProgressReturn: unknown = undefined
let detectedSendersReturn: unknown = []
let startScanFn = vi.fn().mockResolvedValue({ success: true })

// Mock Convex hooks - vi.mock is hoisted, so we use a closure pattern
vi.mock("convex/react", () => ({
  useQuery: (queryRef: string) => {
    if (queryRef === "getScanProgress") return scanProgressReturn
    if (queryRef === "getDetectedSenders") return detectedSendersReturn
    return undefined
  },
  useAction: () => startScanFn,
}))

// Mock the api import
vi.mock("@hushletter/backend", () => ({
  api: {
    gmail: {
      getScanProgress: "getScanProgress",
      getDetectedSenders: "getDetectedSenders",
      startScan: "startScan",
    },
  },
}))

describe("SenderScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scanProgressReturn = undefined
    detectedSendersReturn = []
    startScanFn = vi.fn().mockResolvedValue({ success: true })
  })

  describe("Loading state", () => {
    it("shows skeleton when queries are loading", () => {
      scanProgressReturn = undefined

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      // Should show loading skeleton with animate-pulse
      const skeleton = document.querySelector(".animate-pulse")
      expect(skeleton).not.toBeNull()
    })
  })

  describe("Idle state (no scan started)", () => {
    it("shows Scan for Newsletters button when no scan progress", () => {
      scanProgressReturn = null
      detectedSendersReturn = []

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      expect(screen.getByRole("button", { name: /scan for newsletters/i })).toBeDefined()
      expect(screen.getByText(/find your newsletters/i)).toBeDefined()
    })

    it("starts scan when button is clicked", async () => {
      const user = userEvent.setup()
      scanProgressReturn = null
      detectedSendersReturn = []

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      const scanButton = screen.getByRole("button", {
        name: /scan for newsletters/i,
      })
      await user.click(scanButton)

      expect(startScanFn).toHaveBeenCalledTimes(1)
    })
  })

  describe("Scanning state", () => {
    it("shows progress indicator when scanning", () => {
      scanProgressReturn = {
        status: "scanning",
        totalEmails: 100,
        processedEmails: 45,
        sendersFound: 5,
      }
      detectedSendersReturn = []

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      expect(screen.getByText(/scanning your gmail/i)).toBeDefined()
      expect(screen.getByText("45")).toBeDefined() // processed emails
      expect(screen.getByText("5")).toBeDefined() // senders found
      expect(screen.getByRole("progressbar")).toBeDefined()
    })

    it("shows correct percentage in progress bar", () => {
      scanProgressReturn = {
        status: "scanning",
        totalEmails: 100,
        processedEmails: 50,
        sendersFound: 3,
      }
      detectedSendersReturn = []

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      expect(screen.getByText("50%")).toBeDefined()
    })
  })

  describe("Complete state with results", () => {
    it("shows detected senders list", () => {
      scanProgressReturn = {
        status: "complete",
        totalEmails: 100,
        processedEmails: 100,
        sendersFound: 2,
      }
      detectedSendersReturn = [
        {
          _id: "sender1",
          email: "newsletter@substack.com",
          name: "Tech Newsletter",
          domain: "substack.com",
          emailCount: 25,
          confidenceScore: 80,
          sampleSubjects: ["Subject 1", "Subject 2"],
        },
        {
          _id: "sender2",
          email: "weekly@beehiiv.com",
          name: null,
          domain: "beehiiv.com",
          emailCount: 10,
          confidenceScore: 60,
          sampleSubjects: ["Weekly Update"],
        },
      ]

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      expect(screen.getByText(/scan complete/i)).toBeDefined()
      expect(screen.getByText(/found 2 newsletter senders/i)).toBeDefined()
      expect(screen.getByText("Tech Newsletter")).toBeDefined()
      expect(screen.getByText("weekly@beehiiv.com")).toBeDefined()
      expect(screen.getByText("25 emails found")).toBeDefined()
      expect(screen.getByText("10 emails found")).toBeDefined()
    })

    it("shows confidence badges", () => {
      scanProgressReturn = {
        status: "complete",
        totalEmails: 100,
        processedEmails: 100,
        sendersFound: 2,
      }
      detectedSendersReturn = [
        {
          _id: "sender1",
          email: "high@example.com",
          name: "High Confidence",
          domain: "example.com",
          emailCount: 10,
          confidenceScore: 90, // High
          sampleSubjects: [],
        },
        {
          _id: "sender2",
          email: "medium@example.com",
          name: "Medium Confidence",
          domain: "example.com",
          emailCount: 5,
          confidenceScore: 60, // Medium
          sampleSubjects: [],
        },
      ]

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      expect(screen.getByText("High")).toBeDefined()
      expect(screen.getByText("Medium")).toBeDefined()
    })

    it("shows rescan button in complete state", () => {
      scanProgressReturn = {
        status: "complete",
        totalEmails: 100,
        processedEmails: 100,
        sendersFound: 1,
      }
      detectedSendersReturn = [
        {
          _id: "sender1",
          email: "test@example.com",
          domain: "example.com",
          emailCount: 5,
          confidenceScore: 50,
          sampleSubjects: [],
        },
      ]

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      // Rescan button should be present (it's an icon button with title "Rescan")
      const rescanButton = screen.getByTitle("Rescan")
      expect(rescanButton).toBeDefined()
    })
  })

  describe("Empty state (no newsletters found)", () => {
    it("shows empty state message", () => {
      scanProgressReturn = {
        status: "complete",
        totalEmails: 100,
        processedEmails: 100,
        sendersFound: 0,
      }
      detectedSendersReturn = []

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      expect(screen.getByText(/no newsletters found/i)).toBeDefined()
      expect(screen.getByRole("button", { name: /scan again/i })).toBeDefined()
    })

    it("allows rescan from empty state", async () => {
      const user = userEvent.setup()
      scanProgressReturn = {
        status: "complete",
        totalEmails: 100,
        processedEmails: 100,
        sendersFound: 0,
      }
      detectedSendersReturn = []

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      const rescanButton = screen.getByRole("button", { name: /scan again/i })
      await user.click(rescanButton)

      expect(startScanFn).toHaveBeenCalledTimes(1)
    })
  })

  describe("Error state", () => {
    it("shows error message when scan fails", () => {
      scanProgressReturn = {
        status: "error",
        totalEmails: 0,
        processedEmails: 0,
        sendersFound: 0,
        error: "Gmail token expired. Please reconnect.",
      }
      detectedSendersReturn = []

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      expect(screen.getByText(/scan failed/i)).toBeDefined()
      expect(screen.getByText(/gmail token expired/i)).toBeDefined()
      expect(screen.getByRole("button", { name: /try again/i })).toBeDefined()
    })

    it("allows retry from error state", async () => {
      const user = userEvent.setup()
      scanProgressReturn = {
        status: "error",
        totalEmails: 0,
        processedEmails: 0,
        sendersFound: 0,
        error: "Rate limited",
      }
      detectedSendersReturn = []

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      const retryButton = screen.getByRole("button", { name: /try again/i })
      await user.click(retryButton)

      expect(startScanFn).toHaveBeenCalledTimes(1)
    })

    it("shows local error when action fails", async () => {
      const user = userEvent.setup()
      startScanFn = vi.fn().mockRejectedValue(new Error("Network error"))
      scanProgressReturn = null
      detectedSendersReturn = []

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      const scanButton = screen.getByRole("button", {
        name: /scan for newsletters/i,
      })
      await user.click(scanButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to start scan/i)).toBeDefined()
      })
    })
  })

  describe("Story 4.2 AC validation", () => {
    it("AC #1: Shows Scan for Newsletters button and progress indicator", () => {
      // Start with idle state
      scanProgressReturn = null
      detectedSendersReturn = []

      const { rerender } = render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      // Button is present in idle state
      expect(screen.getByRole("button", { name: /scan for newsletters/i })).toBeDefined()

      // Now simulate scanning state
      scanProgressReturn = {
        status: "scanning",
        totalEmails: 50,
        processedEmails: 10,
        sendersFound: 2,
      }

      rerender(<SenderScanner gmailConnectionId={mockConnectionId} />)

      // Progress indicator is present during scanning
      expect(screen.getByRole("progressbar")).toBeDefined()
    })

    it("AC #3: Shows list of detected senders with name, email, and count", () => {
      scanProgressReturn = {
        status: "complete",
        totalEmails: 100,
        processedEmails: 100,
        sendersFound: 1,
      }
      detectedSendersReturn = [
        {
          _id: "sender1",
          email: "weekly@tech.io",
          name: "Tech Weekly",
          domain: "tech.io",
          emailCount: 42,
          confidenceScore: 75,
          sampleSubjects: ["Issue #1"],
        },
      ]

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      // Name displayed
      expect(screen.getByText("Tech Weekly")).toBeDefined()
      // Email displayed
      expect(screen.getByText("weekly@tech.io")).toBeDefined()
      // Count displayed
      expect(screen.getByText("42 emails found")).toBeDefined()
    })

    it("AC #4: Shows message and rescan option when no newsletters found", () => {
      scanProgressReturn = {
        status: "complete",
        totalEmails: 100,
        processedEmails: 100,
        sendersFound: 0,
      }
      detectedSendersReturn = []

      render(<SenderScanner gmailConnectionId={mockConnectionId} />)

      // Message indicating no newsletters
      expect(screen.getByText(/no newsletters found/i)).toBeDefined()
      // Rescan option
      expect(screen.getByRole("button", { name: /scan again/i })).toBeDefined()
    })
  })
})
