import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DedicatedEmailDisplay } from "./DedicatedEmailDisplay"

// Mock clipboard API
const mockWriteText = vi.fn()

describe("DedicatedEmailDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup clipboard mock
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("Rendering", () => {
    it("displays the email address", () => {
      render(<DedicatedEmailDisplay email="test123@newsletters.example.com" />)

      expect(screen.getByText("test123@newsletters.example.com")).toBeInTheDocument()
    })

    it("displays the label text", () => {
      render(<DedicatedEmailDisplay email="test@example.com" />)

      expect(screen.getByText("Your Newsletter Email")).toBeInTheDocument()
    })

    it("renders copy button with correct aria-label", () => {
      render(<DedicatedEmailDisplay email="test@example.com" />)

      expect(screen.getByRole("button", { name: "Copy email address" })).toBeInTheDocument()
    })
  })

  describe("Copy Functionality (AC2)", () => {
    it("copies email to clipboard when button is clicked", async () => {
      const user = userEvent.setup()
      mockWriteText.mockResolvedValue(undefined)

      render(<DedicatedEmailDisplay email="abc12345@newsletters.example.com" />)

      const copyButton = screen.getByRole("button", { name: "Copy email address" })
      await user.click(copyButton)

      expect(mockWriteText).toHaveBeenCalledWith("abc12345@newsletters.example.com")
    })

    it("shows success state after copying", async () => {
      const user = userEvent.setup()
      mockWriteText.mockResolvedValue(undefined)

      render(<DedicatedEmailDisplay email="test@example.com" />)

      const copyButton = screen.getByRole("button", { name: "Copy email address" })
      await user.click(copyButton)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()
      })
    })

    it("shows error state when copy fails", async () => {
      const user = userEvent.setup()
      mockWriteText.mockRejectedValue(new Error("Clipboard access denied"))

      render(<DedicatedEmailDisplay email="test@example.com" />)

      const copyButton = screen.getByRole("button", { name: "Copy email address" })
      await user.click(copyButton)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Failed to copy" })).toBeInTheDocument()
        expect(screen.getByRole("alert")).toHaveTextContent("Copy failed")
      })
    })

    it("resets to idle state after success timeout", async () => {
      vi.useFakeTimers()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      mockWriteText.mockResolvedValue(undefined)

      render(<DedicatedEmailDisplay email="test@example.com" />)

      const copyButton = screen.getByRole("button", { name: "Copy email address" })
      await user.click(copyButton)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()
      })

      // Advance time by 2 seconds (success timeout)
      vi.advanceTimersByTime(2000)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Copy email address" })).toBeInTheDocument()
      })
    })
  })
})
