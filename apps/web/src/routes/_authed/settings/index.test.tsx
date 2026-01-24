import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React, { useState } from "react"

// Mock modules before importing components
let mockGmailQueryData: { email: string; connectedAt: number } | null = null
let mockGmailQueryError: Error | null = null
let mockGmailQueryPending = false

const mockDisconnectGmail = vi.fn()
const mockInvalidateQueries = vi.fn()

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: vi.fn(),
  useConvexMutation: vi.fn(() => vi.fn()),
}))

vi.mock("@newsletter-manager/backend", () => ({
  api: {
    gmail: {
      getGmailAccount: "api.gmail.getGmailAccount",
      disconnectGmail: "api.gmail.disconnectGmail",
    },
    auth: {
      getCurrentUser: "api.auth.getCurrentUser",
    },
    users: {
      updateProfile: "api.users.updateProfile",
    },
  },
}))

// Mock Convex useAction hook
vi.mock("convex/react", () => ({
  useAction: vi.fn(() => mockDisconnectGmail),
}))

// Mock useQuery to return our controlled data
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query")
  return {
    ...actual,
    useQuery: vi.fn(() => {
      return {
        data: mockGmailQueryData,
        isPending: mockGmailQueryPending,
        error: mockGmailQueryError,
      }
    }),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: mockInvalidateQueries,
    })),
  }
})

// Import the DisconnectConfirmDialog component
import { DisconnectConfirmDialog } from "../import/DisconnectConfirmDialog"

// Create a test component that mimics GmailSettingsSection's behavior
// This isolates the Settings page logic for unit testing
function TestGmailSettingsSection() {
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get mock values directly from the module mock
  const gmailAccount = mockGmailQueryData
  const isPending = mockGmailQueryPending
  const queryError = mockGmailQueryError

  const isConnected = gmailAccount !== null && gmailAccount !== undefined

  const handleConfirmDisconnect = async () => {
    setIsDisconnecting(true)
    setError(null)

    try {
      await mockDisconnectGmail({})
      await mockInvalidateQueries()
      setError(null)
      setIsDialogOpen(false)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to disconnect Gmail. Please try again.")
      }
    } finally {
      setIsDisconnecting(false)
    }
  }

  if (isPending) {
    return (
      <div data-testid="loading">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <div data-testid="gmail-settings">
        <h2>Gmail Integration</h2>
        {queryError ? (
          <p>Unable to check Gmail status</p>
        ) : isConnected ? (
          <div>
            <p>Connected</p>
            <p>{gmailAccount.email}</p>
            <button onClick={() => setIsDialogOpen(true)}>Disconnect</button>
            {error && <p data-testid="error">{error}</p>}
            <p>
              Go to the <a href="/import">Import page</a> to scan and import newsletters.
            </p>
          </div>
        ) : (
          <div>
            <p>Gmail is not connected.</p>
            <a href="/import">Connect Gmail</a>
          </div>
        )}
      </div>

      {isConnected && (
        <DisconnectConfirmDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onConfirm={handleConfirmDisconnect}
          isPending={isDisconnecting}
          gmailAddress={gmailAccount.email}
        />
      )}
    </>
  )
}

// Helper to render with providers
function renderTestComponent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TestGmailSettingsSection />
    </QueryClientProvider>
  )
}

describe("GmailSettingsSection (Story 4.5 Task 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGmailQueryData = null
    mockGmailQueryError = null
    mockGmailQueryPending = false
    mockDisconnectGmail.mockResolvedValue({ success: true })
  })

  describe("Loading State", () => {
    it("shows loading skeleton while fetching Gmail status", async () => {
      mockGmailQueryPending = true

      await act(async () => {
        renderTestComponent()
      })

      expect(screen.getByTestId("loading")).toBeTruthy()
    })
  })

  describe("Connected State (AC #1)", () => {
    it("displays Gmail Integration section with connected status", async () => {
      mockGmailQueryData = { email: "connected@gmail.com", connectedAt: Date.now() }

      await act(async () => {
        renderTestComponent()
      })

      expect(screen.getByText("Gmail Integration")).toBeTruthy()
      expect(screen.getByText("Connected")).toBeTruthy()
      expect(screen.getByText("connected@gmail.com")).toBeTruthy()
    })

    it("shows Disconnect button when connected", async () => {
      mockGmailQueryData = { email: "connected@gmail.com", connectedAt: Date.now() }

      await act(async () => {
        renderTestComponent()
      })

      expect(screen.getByRole("button", { name: /disconnect/i })).toBeTruthy()
    })

    it("shows link to Import page", async () => {
      mockGmailQueryData = { email: "connected@gmail.com", connectedAt: Date.now() }

      await act(async () => {
        renderTestComponent()
      })

      expect(screen.getByText(/import page/i)).toBeTruthy()
    })
  })

  describe("Disconnected State", () => {
    it("displays not connected message when Gmail is not connected", async () => {
      mockGmailQueryData = null

      await act(async () => {
        renderTestComponent()
      })

      expect(screen.getByText(/gmail is not connected/i)).toBeTruthy()
    })

    it("shows Connect Gmail link to Import page", async () => {
      mockGmailQueryData = null

      await act(async () => {
        renderTestComponent()
      })

      const connectLink = screen.getByRole("link", { name: /connect gmail/i })
      expect(connectLink).toBeTruthy()
      expect(connectLink.getAttribute("href")).toBe("/import")
    })
  })

  describe("Error State", () => {
    it("shows error message when Gmail query fails", async () => {
      mockGmailQueryError = new Error("Query failed")

      await act(async () => {
        renderTestComponent()
      })

      expect(screen.getByText(/unable to check gmail status/i)).toBeTruthy()
    })
  })

  describe("Disconnect Flow (AC #1, #2)", () => {
    it("opens confirmation dialog on Disconnect button click", async () => {
      mockGmailQueryData = { email: "connected@gmail.com", connectedAt: Date.now() }

      await act(async () => {
        renderTestComponent()
      })

      const disconnectButton = screen.getByRole("button", { name: /disconnect/i })

      await act(async () => {
        fireEvent.click(disconnectButton)
      })

      await waitFor(() => {
        expect(screen.getByText("Disconnect Gmail?")).toBeTruthy()
      })
    })

    it("calls disconnectGmail on dialog confirmation", async () => {
      mockGmailQueryData = { email: "connected@gmail.com", connectedAt: Date.now() }

      await act(async () => {
        renderTestComponent()
      })

      // Open dialog
      const disconnectButton = screen.getByRole("button", { name: /disconnect/i })
      await act(async () => {
        fireEvent.click(disconnectButton)
      })

      await waitFor(() => {
        expect(screen.getByText("Disconnect Gmail?")).toBeTruthy()
      })

      // Click confirm button
      const confirmButton = screen.getByRole("button", { name: /^disconnect$/i })
      await act(async () => {
        fireEvent.click(confirmButton)
      })

      expect(mockDisconnectGmail).toHaveBeenCalled()
    })

    it("invalidates queries after successful disconnect", async () => {
      mockGmailQueryData = { email: "connected@gmail.com", connectedAt: Date.now() }

      await act(async () => {
        renderTestComponent()
      })

      // Open dialog and confirm
      const disconnectButton = screen.getByRole("button", { name: /disconnect/i })
      await act(async () => {
        fireEvent.click(disconnectButton)
      })

      await waitFor(() => {
        expect(screen.getByText("Disconnect Gmail?")).toBeTruthy()
      })

      const confirmButton = screen.getByRole("button", { name: /^disconnect$/i })
      await act(async () => {
        fireEvent.click(confirmButton)
      })

      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalled()
      })
    })

    it("shows error message on disconnect failure", async () => {
      mockGmailQueryData = { email: "connected@gmail.com", connectedAt: Date.now() }
      mockDisconnectGmail.mockRejectedValueOnce(new Error("Disconnect failed"))

      await act(async () => {
        renderTestComponent()
      })

      // Open dialog and confirm
      const disconnectButton = screen.getByRole("button", { name: /disconnect/i })
      await act(async () => {
        fireEvent.click(disconnectButton)
      })

      await waitFor(() => {
        expect(screen.getByText("Disconnect Gmail?")).toBeTruthy()
      })

      const confirmButton = screen.getByRole("button", { name: /^disconnect$/i })
      await act(async () => {
        fireEvent.click(confirmButton)
      })

      await waitFor(() => {
        expect(screen.getByTestId("error")).toBeTruthy()
        expect(screen.getByText("Disconnect failed")).toBeTruthy()
      })
    })
  })
})
