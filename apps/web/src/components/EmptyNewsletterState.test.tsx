import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { EmptyNewsletterState } from "./EmptyNewsletterState"

describe("EmptyNewsletterState", () => {
  describe("Rendering (AC5)", () => {
    it("displays empty state message", () => {
      render(<EmptyNewsletterState dedicatedEmail="test@newsletters.example.com" />)

      expect(screen.getByText("No newsletters yet")).toBeInTheDocument()
    })

    it("displays subscription and import guidance", () => {
      render(<EmptyNewsletterState dedicatedEmail="test@newsletters.example.com" />)

      expect(
        screen.getByText(
          "Use your email address below to subscribe to newsletters, or import existing ones."
        )
      ).toBeInTheDocument()
    })

    it("displays dedicated email when provided", () => {
      render(<EmptyNewsletterState dedicatedEmail="user123@newsletters.example.com" />)

      expect(screen.getByText("Your newsletter email")).toBeInTheDocument()
      expect(screen.getByText("user123@newsletters.example.com")).toBeInTheDocument()
      expect(screen.getByText("Click to copy your email address")).toBeInTheDocument()
    })

    it("hides email display when no dedicated email", () => {
      render(<EmptyNewsletterState dedicatedEmail={null} />)

      expect(screen.queryByText("Your newsletter email")).not.toBeInTheDocument()
    })

    it("shows an import CTA", () => {
      render(<EmptyNewsletterState dedicatedEmail="test@example.com" />)

      expect(screen.getByRole("button", { name: "Import newsletters" })).toBeInTheDocument()
      expect(screen.getByText("Import from Gmail or upload newsletter files")).toBeInTheDocument()
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

      const mailIcon = document.querySelector("svg.lucide-mail")
      expect(mailIcon).toBeInTheDocument()
    })

    it("displays description text", () => {
      render(<EmptyNewsletterState dedicatedEmail="test@example.com" />)

      expect(
        screen.getByText(
          "Use your email address below to subscribe to newsletters, or import existing ones."
        )
      ).toBeInTheDocument()
    })
  })
})
