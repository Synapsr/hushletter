import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { NewsletterCard, type NewsletterData } from "./NewsletterCard"

// Mock TanStack Router's Link component
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: { children: React.ReactNode; to: string; params?: Record<string, string>; className?: string }) => (
    <a href={params ? `${to.replace("$id", params.id)}` : to} {...props}>
      {children}
    </a>
  ),
}))

describe("NewsletterCard", () => {
  const mockNewsletter: NewsletterData = {
    _id: "test-id-123",
    subject: "Weekly Tech Digest",
    senderEmail: "newsletter@example.com",
    senderName: "Tech Weekly",
    receivedAt: Date.now() - 1000 * 60 * 30, // 30 minutes ago
    isRead: false,
    isHidden: false,
    isPrivate: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Rendering", () => {
    it("displays sender name when available", () => {
      render(<NewsletterCard newsletter={mockNewsletter} />)

      expect(screen.getByText("Tech Weekly")).toBeInTheDocument()
    })

    it("displays sender email when no sender name", () => {
      const newsletterWithoutName: NewsletterData = {
        ...mockNewsletter,
        senderName: undefined,
      }

      render(<NewsletterCard newsletter={newsletterWithoutName} />)

      expect(screen.getByText("newsletter@example.com")).toBeInTheDocument()
    })

    it("displays subject line", () => {
      render(<NewsletterCard newsletter={mockNewsletter} />)

      expect(screen.getByText("Weekly Tech Digest")).toBeInTheDocument()
    })

    it("displays relative time for recent newsletters", () => {
      render(<NewsletterCard newsletter={mockNewsletter} />)

      // Should show "30m ago" or similar relative time
      expect(screen.getByRole("time")).toBeInTheDocument()
    })

    it("links to newsletter detail page with correct ID", () => {
      render(<NewsletterCard newsletter={mockNewsletter} />)

      const link = screen.getByRole("link")
      expect(link).toHaveAttribute("href", "/newsletters/test-id-123")
    })
  })

  describe("Read/Unread Status (AC2)", () => {
    it("shows visual distinction for unread newsletters", () => {
      render(<NewsletterCard newsletter={mockNewsletter} />)

      // Unread newsletters have a border-l-4 indicator
      const card = screen.getByRole("link").querySelector("[data-slot='card']")
      expect(card).toHaveClass("border-l-4")
    })

    it("removes visual distinction for read newsletters", () => {
      const readNewsletter: NewsletterData = {
        ...mockNewsletter,
        isRead: true,
      }

      render(<NewsletterCard newsletter={readNewsletter} />)

      // Read newsletters should not have the unread indicator
      const card = screen.getByRole("link").querySelector("[data-slot='card']")
      expect(card).not.toHaveClass("border-l-4")
    })

    it("applies muted styling to read newsletter sender", () => {
      const readNewsletter: NewsletterData = {
        ...mockNewsletter,
        isRead: true,
      }

      render(<NewsletterCard newsletter={readNewsletter} />)

      const senderText = screen.getByText("Tech Weekly")
      expect(senderText).toHaveClass("text-muted-foreground")
    })

    it("applies bold styling to unread newsletter sender", () => {
      render(<NewsletterCard newsletter={mockNewsletter} />)

      const senderText = screen.getByText("Tech Weekly")
      expect(senderText).toHaveClass("font-semibold")
    })
  })

  describe("Date Formatting", () => {
    it("shows 'Just now' for very recent newsletters", () => {
      const justNow: NewsletterData = {
        ...mockNewsletter,
        receivedAt: Date.now() - 1000 * 30, // 30 seconds ago
      }

      render(<NewsletterCard newsletter={justNow} />)

      expect(screen.getByText("Just now")).toBeInTheDocument()
    })

    it("shows minutes ago for newsletters under an hour", () => {
      const minutesAgo: NewsletterData = {
        ...mockNewsletter,
        receivedAt: Date.now() - 1000 * 60 * 15, // 15 minutes ago
      }

      render(<NewsletterCard newsletter={minutesAgo} />)

      expect(screen.getByText("15m ago")).toBeInTheDocument()
    })

    it("shows hours ago for newsletters under a day", () => {
      const hoursAgo: NewsletterData = {
        ...mockNewsletter,
        receivedAt: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
      }

      render(<NewsletterCard newsletter={hoursAgo} />)

      expect(screen.getByText("5h ago")).toBeInTheDocument()
    })

    it("shows 'Yesterday' for newsletters from yesterday", () => {
      const yesterday: NewsletterData = {
        ...mockNewsletter,
        receivedAt: Date.now() - 1000 * 60 * 60 * 24 - 1000, // Just over 1 day ago
      }

      render(<NewsletterCard newsletter={yesterday} />)

      expect(screen.getByText("Yesterday")).toBeInTheDocument()
    })

    it("shows days ago for newsletters within a week", () => {
      const daysAgo: NewsletterData = {
        ...mockNewsletter,
        receivedAt: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3 days ago
      }

      render(<NewsletterCard newsletter={daysAgo} />)

      expect(screen.getByText("3 days ago")).toBeInTheDocument()
    })

    it("shows full date for newsletters over a week old", () => {
      const oldNewsletter: NewsletterData = {
        ...mockNewsletter,
        receivedAt: Date.now() - 1000 * 60 * 60 * 24 * 10, // 10 days ago
      }

      render(<NewsletterCard newsletter={oldNewsletter} />)

      // Should show formatted date like "Jan 14, 2026"
      const timeElement = screen.getByRole("time")
      expect(timeElement).toHaveAttribute("datetime")
    })
  })
})
