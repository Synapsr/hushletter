import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react"
import { DedicatedEmailDisplay } from "./DedicatedEmailDisplay"

const mockWriteText = vi.fn()

describe("DedicatedEmailDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    try {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: mockWriteText },
        configurable: true,
      })
    } catch {
      // ignore
    }
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
      mockWriteText.mockResolvedValue(undefined)
      render(<DedicatedEmailDisplay email="abc12345@newsletters.example.com" />)

      const copyButton = screen.getByRole("button", { name: "Copy email address" })
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()
      })
      expect(mockWriteText).toHaveBeenCalledWith("abc12345@newsletters.example.com")
    })

    it("shows success state after copying", async () => {
      mockWriteText.mockResolvedValue(undefined)
      render(<DedicatedEmailDisplay email="test@example.com" />)

      const copyButton = screen.getByRole("button", { name: "Copy email address" })
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()
      })
    })

    it("shows error state when copy fails", async () => {
      mockWriteText.mockRejectedValue(new Error("Clipboard access denied"))
      render(<DedicatedEmailDisplay email="test@example.com" />)

      const copyButton = screen.getByRole("button", { name: "Copy email address" })
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Failed to copy" })).toBeInTheDocument()
        expect(screen.getByRole("alert")).toHaveTextContent("Copy failed")
      })
    })

    it("resets to idle state after success timeout", async () => {
      vi.useFakeTimers()
      mockWriteText.mockResolvedValue(undefined)

      render(<DedicatedEmailDisplay email="test@example.com" />)

      const copyButton = screen.getByRole("button", { name: "Copy email address" })
      fireEvent.click(copyButton)

      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()

      // Advance time by 2 seconds (success timeout)
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      expect(screen.getByRole("button", { name: "Copy email address" })).toBeInTheDocument()
    })
  })
})
