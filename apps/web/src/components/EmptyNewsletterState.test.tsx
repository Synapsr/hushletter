import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { EmptyNewsletterState } from "./EmptyNewsletterState"

// Mock the DedicatedEmailDisplay component
vi.mock("./DedicatedEmailDisplay", () => ({
  DedicatedEmailDisplay: ({ email }: { email: string }) => (
    <div data-testid="dedicated-email">{email}</div>
  ),
}))

describe("EmptyNewsletterState", () => {
  describe("Rendering (AC5)", () => {
    it("displays empty state message", () => {
      render(<EmptyNewsletterState dedicatedEmail="test@newsletters.example.com" />)

      expect(screen.getByText("No newsletters yet")).toBeInTheDocument()
    })

    it("displays getting started instructions", () => {
      render(<EmptyNewsletterState dedicatedEmail="test@newsletters.example.com" />)

      expect(screen.getByText("How to get started:")).toBeInTheDocument()
      expect(screen.getByText(/Copy your dedicated email address/)).toBeInTheDocument()
      expect(screen.getByText(/Subscribe to newsletters/)).toBeInTheDocument()
      expect(screen.getByText(/New newsletters will appear here/)).toBeInTheDocument()
    })

    it("displays dedicated email when provided", () => {
      render(<EmptyNewsletterState dedicatedEmail="user123@newsletters.example.com" />)

      expect(screen.getByTestId("dedicated-email")).toHaveTextContent(
        "user123@newsletters.example.com"
      )
    })

    it("hides email display when no dedicated email", () => {
      render(<EmptyNewsletterState dedicatedEmail={null} />)

      expect(screen.queryByTestId("dedicated-email")).not.toBeInTheDocument()
    })

    it("mentions forwarding as an option", () => {
      render(<EmptyNewsletterState dedicatedEmail="test@example.com" />)

      expect(
        screen.getByText(/forward existing newsletters/i)
      ).toBeInTheDocument()
    })

    it("has accessible heading structure", () => {
      render(<EmptyNewsletterState dedicatedEmail="test@example.com" />)

      // Card title should be present
      const heading = screen.getByText("No newsletters yet")
      expect(heading).toBeInTheDocument()
    })
  })

  describe("Visual Elements", () => {
    it("renders inbox icon", () => {
      render(<EmptyNewsletterState dedicatedEmail="test@example.com" />)

      // The Inbox icon is rendered inside a container div
      const iconContainer = document.querySelector(".rounded-full.bg-muted")
      expect(iconContainer).toBeInTheDocument()
    })

    it("displays description text", () => {
      render(<EmptyNewsletterState dedicatedEmail="test@example.com" />)

      expect(
        screen.getByText(/Start receiving newsletters by subscribing/)
      ).toBeInTheDocument()
    })
  })
})
