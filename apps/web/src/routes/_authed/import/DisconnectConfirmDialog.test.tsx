import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { DisconnectConfirmDialog } from "./-DisconnectConfirmDialog"

describe("DisconnectConfirmDialog (Story 4.5)", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    isPending: false,
    gmailAddress: "user@gmail.com",
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("AC#1: Confirmation Dialog", () => {
    it("shows dialog when open prop is true", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} />)
      })

      expect(screen.getByText("Disconnect Gmail?")).toBeTruthy()
    })

    it("does not show dialog when open prop is false", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} open={false} />)
      })

      expect(screen.queryByText("Disconnect Gmail?")).toBeNull()
    })

    it("displays connected Gmail address", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} />)
      })

      expect(screen.getByText("user@gmail.com")).toBeTruthy()
    })

    it("explains what will be removed", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} />)
      })

      expect(screen.getByText("What will be removed:")).toBeTruthy()
      expect(screen.getByText("Gmail connection and access")).toBeTruthy()
      expect(screen.getByText("Scan progress and detected senders")).toBeTruthy()
      expect(screen.getByText("Pending import queue")).toBeTruthy()
    })

    it("explains what will be preserved", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} />)
      })

      expect(screen.getByText("What will be preserved:")).toBeTruthy()
      expect(screen.getByText("All newsletters already imported")).toBeTruthy()
      expect(screen.getByText("Your reading history and preferences")).toBeTruthy()
      expect(screen.getByText("All other account data")).toBeTruthy()
    })

    it("has Cancel and Disconnect buttons", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} />)
      })

      expect(screen.getByRole("button", { name: /cancel/i })).toBeTruthy()
      expect(screen.getByRole("button", { name: /disconnect/i })).toBeTruthy()
    })

    it("mentions reconnection is possible", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} />)
      })

      expect(screen.getByText(/reconnect gmail at any time/i)).toBeTruthy()
    })
  })

  describe("Dialog Interaction", () => {
    it("Cancel button calls onOpenChange with false", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} />)
      })

      const cancelButton = screen.getByRole("button", { name: /cancel/i })

      await act(async () => {
        fireEvent.click(cancelButton)
      })

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })

    it("Disconnect button calls onConfirm", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} />)
      })

      const disconnectButton = screen.getByRole("button", { name: /^disconnect$/i })

      await act(async () => {
        fireEvent.click(disconnectButton)
      })

      expect(defaultProps.onConfirm).toHaveBeenCalled()
    })

    it("buttons are disabled when isPending is true", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} isPending={true} />)
      })

      const cancelButton = screen.getByRole("button", { name: /cancel/i })
      const disconnectButton = screen.getByRole("button", { name: /disconnecting/i })

      expect(cancelButton.hasAttribute("disabled")).toBe(true)
      expect(disconnectButton.hasAttribute("disabled")).toBe(true)
    })

    it("shows 'Disconnecting...' text when pending", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} isPending={true} />)
      })

      expect(screen.getByText("Disconnecting...")).toBeTruthy()
    })
  })

  describe("Accessibility", () => {
    it("has accessible dialog title", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} />)
      })

      // Dialog should have a title for screen readers
      expect(screen.getByRole("dialog")).toBeTruthy()
      expect(screen.getByText("Disconnect Gmail?")).toBeTruthy()
    })

    it("includes warning icon for visual cue", async () => {
      await act(async () => {
        render(<DisconnectConfirmDialog {...defaultProps} />)
      })

      // The AlertTriangle icon should be present (amber-500 colored)
      const title = screen.getByText("Disconnect Gmail?")
      expect(title.closest("div")?.querySelector("svg")).toBeTruthy()
    })
  })
})
