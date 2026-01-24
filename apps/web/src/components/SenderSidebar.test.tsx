import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  SenderSidebar,
  SenderSidebarSkeleton,
  type SenderData,
} from "./SenderSidebar"

// Mock sender data - sorted alphabetically by displayName as query would return
const mockSenders: SenderData[] = [
  {
    _id: "sender-3",
    email: "alpha@first.com",
    displayName: "alpha@first.com", // No name, uses email as displayName
    domain: "first.com",
    userNewsletterCount: 2,
    unreadCount: 1,
    isPrivate: false,
    folderId: undefined,
  },
  {
    _id: "sender-1",
    email: "news@example.com",
    name: "Example News",
    displayName: "Example News",
    domain: "example.com",
    userNewsletterCount: 10,
    unreadCount: 3,
    isPrivate: false,
    folderId: undefined,
  },
  {
    _id: "sender-2",
    email: "digest@tech.com",
    name: "Tech Digest",
    displayName: "Tech Digest",
    domain: "tech.com",
    userNewsletterCount: 5,
    unreadCount: 0,
    isPrivate: false,
    folderId: undefined,
  },
]

// Track the mock return value so we can change it per test
let mockQueryReturn: { data: SenderData[] | undefined; isPending: boolean } = {
  data: mockSenders,
  isPending: false,
}

// Mock @tanstack/react-query useQuery to return mock data
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query")
  return {
    ...actual,
    useQuery: () => mockQueryReturn,
  }
})

// Mock convex query factory
vi.mock("@convex-dev/react-query", () => ({
  convexQuery: () => ({}),
}))

describe("SenderSidebar", () => {
  let mockOnSenderSelect: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSenderSelect = vi.fn()
    // Reset to default mock data
    mockQueryReturn = {
      data: mockSenders,
      isPending: false,
    }
  })

  const renderSidebar = (
    selectedSenderId: string | null = null,
    totalNewsletterCount = 17,
    totalUnreadCount = 4
  ) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    return render(
      <QueryClientProvider client={queryClient}>
        <SenderSidebar
          selectedSenderId={selectedSenderId}
          onSenderSelect={mockOnSenderSelect}
          totalNewsletterCount={totalNewsletterCount}
          totalUnreadCount={totalUnreadCount}
        />
      </QueryClientProvider>
    )
  }

  describe("Rendering (AC1)", () => {
    it("displays 'All Newsletters' item at top", () => {
      renderSidebar()

      expect(screen.getByText("All Newsletters")).toBeInTheDocument()
    })

    it("displays total newsletter count in 'All' item", () => {
      renderSidebar()

      // Total count should be displayed
      expect(screen.getByText("17")).toBeInTheDocument()
    })

    it("displays all senders from query", () => {
      renderSidebar()

      expect(screen.getByText("Example News")).toBeInTheDocument()
      expect(screen.getByText("Tech Digest")).toBeInTheDocument()
      expect(screen.getByText("alpha@first.com")).toBeInTheDocument()
    })

    it("displays newsletter count for each sender", () => {
      renderSidebar()

      // Each sender's count should be displayed
      expect(screen.getByText("10")).toBeInTheDocument() // Example News
      expect(screen.getByText("5")).toBeInTheDocument() // Tech Digest
      expect(screen.getByText("2")).toBeInTheDocument() // alpha@first.com
    })

    it("displays unread indicators for senders with unread newsletters", () => {
      renderSidebar()

      // Check for unread indicators (small dots) - aria-labels contain unread counts
      const unreadIndicators = screen.getAllByLabelText(/unread/)
      // "All" has 4 unread, "Example News" has 3, "alpha@first.com" has 1
      expect(unreadIndicators.length).toBe(3)
    })

    it("does not display unread indicator for senders with 0 unread", () => {
      renderSidebar()

      // Tech Digest has 0 unread, should not have an indicator
      // The indicator has aria-label with sender name
      expect(
        screen.queryByLabelText(/unread from Tech Digest/)
      ).not.toBeInTheDocument()
    })
  })

  describe("Sender Selection (AC2)", () => {
    it("highlights 'All' when no sender is selected", () => {
      renderSidebar(null)

      const allButton = screen.getByText("All Newsletters").closest("button")
      expect(allButton).toHaveClass("bg-accent")
    })

    it("highlights selected sender", () => {
      renderSidebar("sender-1")

      const senderButton = screen.getByText("Example News").closest("button")
      expect(senderButton).toHaveClass("bg-accent")
    })

    it("does not highlight 'All' when a sender is selected", () => {
      renderSidebar("sender-1")

      const allButton = screen.getByText("All Newsletters").closest("button")
      expect(allButton).not.toHaveClass("bg-accent")
    })

    it("calls onSenderSelect with senderId when sender clicked", () => {
      renderSidebar()

      const senderButton = screen.getByText("Example News").closest("button")
      fireEvent.click(senderButton!)

      expect(mockOnSenderSelect).toHaveBeenCalledWith("sender-1")
    })

    it("calls onSenderSelect with null when 'All' clicked", () => {
      renderSidebar("sender-1")

      const allButton = screen.getByText("All Newsletters").closest("button")
      fireEvent.click(allButton!)

      expect(mockOnSenderSelect).toHaveBeenCalledWith(null)
    })
  })

  describe("Sorting (AC4)", () => {
    it("senders are displayed in order returned by query (alphabetically)", () => {
      renderSidebar()

      // Get all buttons except "All Newsletters"
      const buttons = screen.getAllByRole("button")
      const senderButtons = buttons.slice(1) // Skip "All Newsletters"

      // Verify the display order matches our mock data (which is pre-sorted alphabetically)
      expect(senderButtons[0]).toHaveTextContent("alpha@first.com")
      expect(senderButtons[1]).toHaveTextContent("Example News")
      expect(senderButtons[2]).toHaveTextContent("Tech Digest")
    })
  })

  describe("Empty State", () => {
    it("displays empty message when no senders", () => {
      // Override the mock for this test
      mockQueryReturn = {
        data: [],
        isPending: false,
      }

      renderSidebar()

      expect(screen.getByText("No senders yet")).toBeInTheDocument()
    })
  })

  describe("Loading State", () => {
    it("shows skeleton when data is loading", () => {
      mockQueryReturn = {
        data: undefined,
        isPending: true,
      }

      renderSidebar()

      // Should show skeleton elements
      const skeletonElements = document.querySelectorAll(".animate-pulse")
      expect(skeletonElements.length).toBeGreaterThan(0)
    })
  })
})

describe("SenderSidebarSkeleton", () => {
  it("renders skeleton with loading animation", () => {
    render(<SenderSidebarSkeleton />)

    // Should have skeleton elements with animation
    const skeletonElements = document.querySelectorAll(".animate-pulse")
    expect(skeletonElements.length).toBeGreaterThan(0)
  })

  it("renders correct number of skeleton items", () => {
    render(<SenderSidebarSkeleton />)

    // Should have 1 "All" skeleton + 4 sender skeletons
    const skeletonItems = document.querySelectorAll(".h-10.bg-muted")
    expect(skeletonItems.length).toBe(5)
  })
})
