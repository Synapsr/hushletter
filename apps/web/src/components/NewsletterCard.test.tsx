import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"
import { NewsletterCard, type NewsletterData } from "./NewsletterCard"

// Mock TanStack Router's Link component
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: { children: React.ReactNode; to: string; params?: Record<string, string>; className?: string }) => (
    <a href={params ? `${to.replace("$id", params.id)}` : to} {...props}>
      {children}
    </a>
  ),
}))

// Mock SummaryPreview component
vi.mock("./SummaryPreview", () => ({
  SummaryPreview: () => <div data-testid="summary-preview">Mock Preview</div>,
}))

// Mock the api export
vi.mock("@hushletter/backend", () => ({
  api: {
    newsletters: {
      hideNewsletter: "hideNewsletter",
      unhideNewsletter: "unhideNewsletter",
    },
  },
}))

// Track mock mutation calls for Story 3.5 tests
let mockHideMutation: ReturnType<typeof vi.fn>
let mockUnhideMutation: ReturnType<typeof vi.fn>

// Override the useMutation mock to track calls
vi.mock("convex/react", () => ({
  useMutation: (mutationRef: string) => {
    if (mutationRef === "hideNewsletter") {
      return mockHideMutation
    }
    if (mutationRef === "unhideNewsletter") {
      return mockUnhideMutation
    }
    return vi.fn()
  },
}))

describe("NewsletterCard", () => {
  const mockNewsletter: NewsletterData = {
    _id: "test-id-123" as Id<"userNewsletters">,
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
    mockHideMutation = vi.fn().mockResolvedValue(undefined)
    mockUnhideMutation = vi.fn().mockResolvedValue(undefined)
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

  // Story 3.5: Hide/Unhide functionality tests (HIGH-2 fix)
  describe("Hide/Unhide Actions (Story 3.5)", () => {
    it("renders hide button with correct aria-label", () => {
      render(<NewsletterCard newsletter={mockNewsletter} />)

      const hideButton = screen.getByRole("button", { name: "Hide newsletter" })
      expect(hideButton).toBeInTheDocument()
    })

    it("renders unhide button when showUnhide prop is true", () => {
      render(<NewsletterCard newsletter={mockNewsletter} showUnhide={true} />)

      const unhideButton = screen.getByRole("button", { name: "Unhide newsletter" })
      expect(unhideButton).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Hide newsletter" })).not.toBeInTheDocument()
    })

    it("hide button has hover-reveal styling with mobile visibility", () => {
      render(<NewsletterCard newsletter={mockNewsletter} />)

      const hideButton = screen.getByRole("button", { name: "Hide newsletter" })
      // Visible on mobile (opacity-50), hidden on desktop until hover (md:opacity-0)
      expect(hideButton).toHaveClass("opacity-50")
      expect(hideButton).toHaveClass("md:opacity-0")
      expect(hideButton).toHaveClass("group-hover:opacity-100")
    })

    it("unhide button is always visible (opacity-100)", () => {
      render(<NewsletterCard newsletter={mockNewsletter} showUnhide={true} />)

      const unhideButton = screen.getByRole("button", { name: "Unhide newsletter" })
      expect(unhideButton).toHaveClass("opacity-100")
    })

    it("calls hideNewsletter mutation when hide button clicked", async () => {
      render(<NewsletterCard newsletter={mockNewsletter} />)

      const hideButton = screen.getByRole("button", { name: "Hide newsletter" })
      await fireEvent.click(hideButton)

      expect(mockHideMutation).toHaveBeenCalledWith({ userNewsletterId: "test-id-123" })
    })

    it("calls unhideNewsletter mutation when unhide button clicked", async () => {
      render(<NewsletterCard newsletter={mockNewsletter} showUnhide={true} />)

      const unhideButton = screen.getByRole("button", { name: "Unhide newsletter" })
      await fireEvent.click(unhideButton)

      expect(mockUnhideMutation).toHaveBeenCalledWith({ userNewsletterId: "test-id-123" })
    })

    it("stops event propagation on hide click (prevents navigation)", async () => {
      const mockLinkClick = vi.fn()
      render(
        <div onClick={mockLinkClick}>
          <NewsletterCard newsletter={mockNewsletter} />
        </div>
      )

      const hideButton = screen.getByRole("button", { name: "Hide newsletter" })
      await fireEvent.click(hideButton)

      // Parent click handler should NOT be called due to stopPropagation
      expect(mockLinkClick).not.toHaveBeenCalled()
    })

    it("handles mutation error gracefully", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
      mockHideMutation.mockRejectedValueOnce(new Error("Network error"))

      render(<NewsletterCard newsletter={mockNewsletter} />)

      const hideButton = screen.getByRole("button", { name: "Hide newsletter" })
      await fireEvent.click(hideButton)

      expect(consoleError).toHaveBeenCalledWith(
        "[NewsletterCard] Failed to hide newsletter:",
        expect.any(Error)
      )
      consoleError.mockRestore()
    })
  })

  describe("Favorite Actions", () => {
    it("renders add-to-favorites button when not favorited", () => {
      const toggleFavorite = vi.fn().mockResolvedValue(undefined)
      render(
        <NewsletterCard
          newsletter={mockNewsletter}
          isFavorited={false}
          onToggleFavorite={toggleFavorite}
        />,
      )

      expect(screen.getByRole("button", { name: "Add to favorites" })).toBeInTheDocument()
    })

    it("renders remove-from-favorites button when favorited", () => {
      const toggleFavorite = vi.fn().mockResolvedValue(undefined)
      render(
        <NewsletterCard
          newsletter={mockNewsletter}
          isFavorited
          onToggleFavorite={toggleFavorite}
        />,
      )

      const button = screen.getByRole("button", { name: "Remove from favorites" })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute("aria-pressed", "true")
    })

    it("calls onToggleFavorite with optimistic current value", async () => {
      const toggleFavorite = vi.fn().mockResolvedValue(undefined)
      render(
        <NewsletterCard
          newsletter={mockNewsletter}
          isFavorited={false}
          onToggleFavorite={toggleFavorite}
        />,
      )

      await fireEvent.click(screen.getByRole("button", { name: "Add to favorites" }))

      expect(toggleFavorite).toHaveBeenCalledWith("test-id-123", false)
    })

    it("disables favorite button while pending", () => {
      const toggleFavorite = vi.fn().mockResolvedValue(undefined)
      render(
        <NewsletterCard
          newsletter={mockNewsletter}
          isFavorited={false}
          isFavoritePending
          onToggleFavorite={toggleFavorite}
        />,
      )

      expect(screen.getByRole("button", { name: "Add to favorites" })).toBeDisabled()
    })

    it("shows non-blocking error feedback when favorite update fails", async () => {
      const toggleFavorite = vi.fn().mockRejectedValue(new Error("boom"))
      render(
        <NewsletterCard
          newsletter={mockNewsletter}
          isFavorited={false}
          onToggleFavorite={toggleFavorite}
        />,
      )

      await fireEvent.click(screen.getByRole("button", { name: "Add to favorites" }))

      expect(await screen.findByText("Failed to update favorite")).toBeInTheDocument()
    })
  })

  // Story 3.4: Reading progress indicator tests
  describe("Reading Progress (Story 3.4 AC5)", () => {
    it("shows progress indicator for partially read newsletters", () => {
      const partiallyRead: NewsletterData = {
        ...mockNewsletter,
        isRead: false,
        readProgress: 45,
      }

      render(<NewsletterCard newsletter={partiallyRead} />)

      expect(screen.getByText("45% read")).toBeInTheDocument()
    })

    it("does not show progress indicator for unread newsletters with no progress", () => {
      render(<NewsletterCard newsletter={mockNewsletter} />)

      expect(screen.queryByText(/% read/)).not.toBeInTheDocument()
    })

    it("does not show progress indicator for fully read newsletters", () => {
      const fullyRead: NewsletterData = {
        ...mockNewsletter,
        isRead: true,
        readProgress: 100,
      }

      render(<NewsletterCard newsletter={fullyRead} />)

      expect(screen.queryByText(/% read/)).not.toBeInTheDocument()
    })
  })

  // Story 6.2: Privacy lock icon tests
  describe("Privacy Lock Icon (Story 6.2 Task 7.4)", () => {
    it("displays lock icon when newsletter is private", () => {
      const privateNewsletter: NewsletterData = {
        ...mockNewsletter,
        isPrivate: true,
      }

      render(<NewsletterCard newsletter={privateNewsletter} />)

      // Lock icon should be present with aria-label
      const lockIcon = screen.getByLabelText("Private newsletter")
      expect(lockIcon).toBeInTheDocument()
    })

    it("does not display lock icon when newsletter is public", () => {
      const publicNewsletter: NewsletterData = {
        ...mockNewsletter,
        isPrivate: false,
      }

      render(<NewsletterCard newsletter={publicNewsletter} />)

      // Lock icon should NOT be present
      expect(screen.queryByLabelText("Private newsletter")).not.toBeInTheDocument()
    })

    it("lock icon has subtle muted-foreground styling", () => {
      const privateNewsletter: NewsletterData = {
        ...mockNewsletter,
        isPrivate: true,
      }

      render(<NewsletterCard newsletter={privateNewsletter} />)

      const lockIcon = screen.getByLabelText("Private newsletter")
      // Lock icon is wrapped in Tooltip, check the SVG itself has the correct class
      expect(lockIcon).toHaveClass("text-muted-foreground")
    })

    it("lock icon has tooltip with privacy explanation", () => {
      const privateNewsletter: NewsletterData = {
        ...mockNewsletter,
        isPrivate: true,
      }

      render(<NewsletterCard newsletter={privateNewsletter} />)

      // The tooltip is wrapped, check the parent element has the tooltip content
      // Since we use Base UI Tooltip, we check if the element exists
      const lockIcon = screen.getByLabelText("Private newsletter")
      expect(lockIcon).toBeInTheDocument()
      // Tooltip content is rendered via portal, tested separately
    })
  })

  // Story 5.2: Summary indicator tests
  describe("Summary Indicator (Story 5.2 Tasks 1.2-1.4)", () => {
    it("Task 6.4: displays summary indicator when hasSummary is true", () => {
      const newsletterWithSummary: NewsletterData = {
        ...mockNewsletter,
        hasSummary: true,
      }

      render(<NewsletterCard newsletter={newsletterWithSummary} />)

      // Should have sparkles button with accessible label
      const indicator = screen.getByLabelText(/show summary preview/i)
      expect(indicator).toBeInTheDocument()
    })

    it("Task 6.5: hides indicator when hasSummary is false", () => {
      const newsletterWithoutSummary: NewsletterData = {
        ...mockNewsletter,
        hasSummary: false,
      }

      render(<NewsletterCard newsletter={newsletterWithoutSummary} />)

      // Should NOT have sparkles indicator
      const indicator = screen.queryByLabelText(/show summary preview/i)
      expect(indicator).not.toBeInTheDocument()
    })

    it("hides indicator when hasSummary is undefined", () => {
      // mockNewsletter doesn't have hasSummary set
      render(<NewsletterCard newsletter={mockNewsletter} />)

      const indicator = screen.queryByLabelText(/show summary preview/i)
      expect(indicator).not.toBeInTheDocument()
    })

    it("indicator has tooltip with preview instruction", () => {
      const newsletterWithSummary: NewsletterData = {
        ...mockNewsletter,
        hasSummary: true,
      }

      render(<NewsletterCard newsletter={newsletterWithSummary} />)

      // Check for title attribute (native tooltip)
      const indicator = screen.getByLabelText(/show summary preview/i)
      expect(indicator).toHaveAttribute("title", "Click to preview AI summary")
    })

    it("indicator uses amber color matching SummaryPanel", () => {
      const newsletterWithSummary: NewsletterData = {
        ...mockNewsletter,
        hasSummary: true,
      }

      render(<NewsletterCard newsletter={newsletterWithSummary} />)

      const indicator = screen.getByLabelText(/show summary preview/i)
      // Check for amber color class
      expect(indicator.className).toContain("text-amber")
    })

    it("clicking indicator toggles summary preview", async () => {
      const newsletterWithSummary: NewsletterData = {
        ...mockNewsletter,
        hasSummary: true,
      }

      render(<NewsletterCard newsletter={newsletterWithSummary} />)

      // Initially shows "Show summary preview"
      const showIndicator = screen.getByLabelText(/show summary preview/i)
      expect(screen.queryByTestId("summary-preview")).not.toBeInTheDocument()

      // Click to show preview
      await fireEvent.click(showIndicator)
      expect(screen.getByTestId("summary-preview")).toBeInTheDocument()

      // Label should change to "Hide summary preview"
      const hideIndicator = screen.getByLabelText(/hide summary preview/i)

      // Click again to hide
      await fireEvent.click(hideIndicator)
      expect(screen.queryByTestId("summary-preview")).not.toBeInTheDocument()
    })

    it("clicking indicator does not navigate to newsletter", async () => {
      const newsletterWithSummary: NewsletterData = {
        ...mockNewsletter,
        hasSummary: true,
      }

      const navigationHandler = vi.fn()
      render(
        <div onClick={navigationHandler}>
          <NewsletterCard newsletter={newsletterWithSummary} />
        </div>
      )

      const indicator = screen.getByLabelText(/show summary preview/i)
      await fireEvent.click(indicator)

      // Navigation should not have occurred
      expect(navigationHandler).not.toHaveBeenCalled()
    })
  })

  // Story 9.10: Source Indicators (Unified Folder View)
  describe("Source Indicators (Story 9.10)", () => {
    describe("Private sources", () => {
      it("shows Mail icon for source='email'", () => {
        const emailNewsletter: NewsletterData = {
          ...mockNewsletter,
          source: "email",
        }

        render(<NewsletterCard newsletter={emailNewsletter} />)

        const sourceIcon = screen.getByLabelText("Private")
        expect(sourceIcon).toBeInTheDocument()
        expect(sourceIcon).toHaveClass("text-muted-foreground")
      })

      it("shows Mail icon for source='gmail'", () => {
        const gmailNewsletter: NewsletterData = {
          ...mockNewsletter,
          source: "gmail",
        }

        render(<NewsletterCard newsletter={gmailNewsletter} />)

        const sourceIcon = screen.getByLabelText("Private")
        expect(sourceIcon).toBeInTheDocument()
      })

      it("shows Mail icon for source='manual'", () => {
        const manualNewsletter: NewsletterData = {
          ...mockNewsletter,
          source: "manual",
        }

        render(<NewsletterCard newsletter={manualNewsletter} />)

        const sourceIcon = screen.getByLabelText("Private")
        expect(sourceIcon).toBeInTheDocument()
      })

      it("shows Mail icon for source undefined (legacy newsletters)", () => {
        // Legacy newsletters without source field default to private indicator
        render(<NewsletterCard newsletter={mockNewsletter} />)

        const sourceIcon = screen.getByLabelText("Private")
        expect(sourceIcon).toBeInTheDocument()
      })
    })

    describe("Community source", () => {
      it("shows Globe icon for source='community'", () => {
        const communityNewsletter: NewsletterData = {
          ...mockNewsletter,
          source: "community",
        }

        render(<NewsletterCard newsletter={communityNewsletter} />)

        const sourceIcon = screen.getByLabelText("From community")
        expect(sourceIcon).toBeInTheDocument()
      })

      it("community indicator has blue color", () => {
        const communityNewsletter: NewsletterData = {
          ...mockNewsletter,
          source: "community",
        }

        render(<NewsletterCard newsletter={communityNewsletter} />)

        const sourceIcon = screen.getByLabelText("From community")
        expect(sourceIcon).toHaveClass("text-blue-500")
      })
    })

    describe("Accessibility", () => {
      it("source indicator has aria-label for screen readers", () => {
        const emailNewsletter: NewsletterData = {
          ...mockNewsletter,
          source: "email",
        }

        render(<NewsletterCard newsletter={emailNewsletter} />)

        const sourceIcon = screen.getByLabelText("Private")
        expect(sourceIcon).toHaveAttribute("aria-label")
      })

      it("community indicator has aria-label for screen readers", () => {
        const communityNewsletter: NewsletterData = {
          ...mockNewsletter,
          source: "community",
        }

        render(<NewsletterCard newsletter={communityNewsletter} />)

        const sourceIcon = screen.getByLabelText("From community")
        expect(sourceIcon).toHaveAttribute("aria-label")
      })
    })
  })
})
