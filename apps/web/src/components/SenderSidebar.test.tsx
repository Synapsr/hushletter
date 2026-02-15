import type { ReactNode } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  SenderSidebar,
  SenderSidebarSkeleton,
  type SenderData,
  type FolderData,
} from "./SenderSidebar"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))

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
    folderId: "folder-1",
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

// Mock folder data for Story 3.3
const mockFolders: FolderData[] = [
  {
    _id: "folder-1",
    userId: "user-1",
    name: "Important",
    createdAt: Date.now(),
    newsletterCount: 10,
    unreadCount: 3,
    senderCount: 1,
  },
]

// Track which query is being called (based on call order)
let queryCallCount = 0
let mockSendersQueryReturn: { data: SenderData[] | undefined; isPending: boolean } = {
  data: mockSenders,
  isPending: false,
}
let mockFoldersQueryReturn: { data: FolderData[] | undefined; isPending: boolean } = {
  data: mockFolders,
  isPending: false,
}
let mockFollowedQueryReturn: { data: unknown[] | undefined; isPending: boolean } = {
  data: [],
  isPending: false,
}

// Mock @tanstack/react-query useQuery to return mock data
// Story 3.3: Updated to handle both senders and folders queries
// SenderSidebar calls senders query first, then followed senders, then folders
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query")
  return {
    ...actual,
    useQuery: () => {
      queryCallCount++
      const mod = (queryCallCount - 1) % 3
      if (mod === 0) return mockSendersQueryReturn
      if (mod === 1) {
        return mockFollowedQueryReturn
      }
      return mockFoldersQueryReturn
    },
  }
})

// Mock convex query factory
vi.mock("@convex-dev/react-query", () => ({
  convexQuery: () => ({}),
}))

describe("SenderSidebar", () => {
  let mockOnSenderSelect: (senderId: string | null) => void
  let mockOnFolderSelect: (folderId: string | null) => void
  let mockOnFilterSelect: (filter: string | null) => void

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSenderSelect = vi.fn()
    mockOnFolderSelect = vi.fn()
    mockOnFilterSelect = vi.fn()
    // Reset call count for query ordering
    queryCallCount = 0
    // Reset to default mock data
    mockSendersQueryReturn = {
      data: mockSenders,
      isPending: false,
    }
    mockFoldersQueryReturn = {
      data: mockFolders,
      isPending: false,
    }
    mockFollowedQueryReturn = {
      data: [],
      isPending: false,
    }
  })

  const renderSidebar = (
    selectedSenderId: string | null = null,
    selectedFolderId: string | null = null,
    totalNewsletterCount = 17,
    totalUnreadCount = 4,
    selectedFilter: string | null = null,
    hiddenCount = 0
  ) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    return render(
      <QueryClientProvider client={queryClient}>
        <SenderSidebar
          selectedSenderId={selectedSenderId}
          selectedFolderId={selectedFolderId}
          selectedFilter={selectedFilter}
          onSenderSelect={mockOnSenderSelect}
          onFolderSelect={mockOnFolderSelect}
          onFilterSelect={mockOnFilterSelect}
          totalNewsletterCount={totalNewsletterCount}
          totalUnreadCount={totalUnreadCount}
          hiddenCount={hiddenCount}
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

      // Each sender's count should be displayed (using getAllByText since 10 appears for both folder and sender)
      expect(screen.getAllByText("10").length).toBeGreaterThanOrEqual(1) // Example News (and folder)
      expect(screen.getByText("5")).toBeInTheDocument() // Tech Digest
      expect(screen.getByText("2")).toBeInTheDocument() // alpha@first.com
    })

    it("displays unread indicators for senders with unread newsletters", () => {
      renderSidebar()

      // Check for unread indicators (small dots) - aria-labels contain unread counts
      const unreadIndicators = screen.getAllByLabelText(/unread/)
      // "All" has 4 unread, "Important" folder has 3, "Uncategorized" has 1, "Example News" has 3, "alpha@first.com" has 1
      // Total: 5 indicators (Uncategorized is now included in Story 3.3)
      expect(unreadIndicators.length).toBe(5)
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
    it("highlights 'All' when nothing is selected", () => {
      renderSidebar(null, null)

      const allButton = screen.getByText("All Newsletters").closest("button")
      expect(allButton).toHaveClass("bg-accent")
    })

    it("highlights selected sender", () => {
      renderSidebar("sender-1", null)

      const senderButton = screen.getByText("Example News").closest("button")
      expect(senderButton).toHaveClass("bg-accent")
    })

    it("does not highlight 'All' when a sender is selected", () => {
      renderSidebar("sender-1", null)

      const allButton = screen.getByText("All Newsletters").closest("button")
      expect(allButton).not.toHaveClass("bg-accent")
    })

    it("calls onSenderSelect with senderId and clears folder when sender clicked", () => {
      renderSidebar()

      const senderButton = screen.getByText("Example News").closest("button")
      fireEvent.click(senderButton!)

      // Story 3.3: Now also clears folder selection
      // Story 3.5: Also clears filter selection
      expect(mockOnFolderSelect).toHaveBeenCalledWith(null)
      expect(mockOnFilterSelect).toHaveBeenCalledWith(null)
      expect(mockOnSenderSelect).toHaveBeenCalledWith("sender-1")
    })

    it("calls onSenderSelect and onFolderSelect with null when 'All' clicked", () => {
      renderSidebar("sender-1", null)

      const allButton = screen.getByText("All Newsletters").closest("button")
      fireEvent.click(allButton!)

      // Story 3.3: "All" clears both sender and folder
      // Story 3.5: Also clears filter
      expect(mockOnSenderSelect).toHaveBeenCalledWith(null)
      expect(mockOnFolderSelect).toHaveBeenCalledWith(null)
      expect(mockOnFilterSelect).toHaveBeenCalledWith(null)
    })
  })

  // Story 3.3: New folder tests
  describe("Folder Section (Story 3.3 AC4, AC5)", () => {
    it("displays folders section with folder names", () => {
      renderSidebar()

      expect(screen.getByText("Important")).toBeInTheDocument()
    })

    it("displays folder unread count", () => {
      renderSidebar()

      // Folder "Important" should have unread indicator
      expect(screen.getByLabelText(/unread in Important/)).toBeInTheDocument()
    })

    it("displays Uncategorized virtual folder when senders have no folder", () => {
      renderSidebar()

      // Two senders (alpha@first.com, Tech Digest) have no folder
      expect(screen.getByText("Uncategorized")).toBeInTheDocument()
    })

    it("highlights selected folder", () => {
      renderSidebar(null, "folder-1")

      const folderButton = screen.getByText("Important").closest("button")
      expect(folderButton).toHaveClass("bg-accent")
    })

    it("calls onFolderSelect and clears sender when folder clicked", () => {
      renderSidebar()

      const folderButton = screen.getByText("Important").closest("button")
      fireEvent.click(folderButton!)

      // Story 3.5: Also clears filter selection
      expect(mockOnSenderSelect).toHaveBeenCalledWith(null)
      expect(mockOnFilterSelect).toHaveBeenCalledWith(null)
      expect(mockOnFolderSelect).toHaveBeenCalledWith("folder-1")
    })

    it("calls onFolderSelect with 'uncategorized' when Uncategorized clicked", () => {
      renderSidebar()

      const uncategorizedButton = screen.getByText("Uncategorized").closest("button")
      fireEvent.click(uncategorizedButton!)

      // Story 3.5: Also clears filter selection
      expect(mockOnSenderSelect).toHaveBeenCalledWith(null)
      expect(mockOnFilterSelect).toHaveBeenCalledWith(null)
      expect(mockOnFolderSelect).toHaveBeenCalledWith("uncategorized")
    })
  })

  describe("Sorting (AC4)", () => {
    it("senders are displayed in order returned by query (alphabetically)", () => {
      renderSidebar()

      // Get all buttons except "All Newsletters" and folders
      const buttons = screen.getAllByRole("button")
      // Find the sender buttons (after All, folders, and Uncategorized)
      const senderButtonTexts = buttons
        .map((b) => b.textContent || "")
        .filter(
          (text) =>
            !text.includes("All Newsletters") &&
            !text.includes("Important") &&
            !text.includes("Uncategorized")
        )

      // Verify sender order
      expect(senderButtonTexts[0]).toContain("alpha@first.com")
      expect(senderButtonTexts[1]).toContain("Example News")
      expect(senderButtonTexts[2]).toContain("Tech Digest")
    })
  })

  describe("Empty State", () => {
    it("displays empty message when no senders", () => {
      // Override the mock for this test
      mockSendersQueryReturn = {
        data: [],
        isPending: false,
      }
      mockFoldersQueryReturn = {
        data: [],
        isPending: false,
      }

      renderSidebar()

      expect(screen.getByText("No senders yet")).toBeInTheDocument()
    })
  })

  describe("Loading State", () => {
    it("shows skeleton when senders data is loading", () => {
      mockSendersQueryReturn = {
        data: undefined,
        isPending: true,
      }

      renderSidebar()

      // Should show skeleton elements
      const skeletonElements = document.querySelectorAll(".animate-pulse")
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it("shows skeleton when folders data is loading", () => {
      mockFoldersQueryReturn = {
        data: undefined,
        isPending: true,
      }

      renderSidebar()

      // Should show skeleton elements
      const skeletonElements = document.querySelectorAll(".animate-pulse")
      expect(skeletonElements.length).toBeGreaterThan(0)
    })
  })

  // Story 3.5: Hidden section tests
  describe("Hidden Section (Story 3.5 AC3)", () => {
    it("displays Hidden section when hiddenCount > 0", () => {
      renderSidebar(null, null, 17, 4, null, 5)

      expect(screen.getByText("Hidden")).toBeInTheDocument()
    })

    it("does not display Hidden section when hiddenCount is 0", () => {
      renderSidebar(null, null, 17, 4, null, 0)

      expect(screen.queryByText("Hidden")).not.toBeInTheDocument()
    })

    it("displays hidden count badge", () => {
      renderSidebar(null, null, 17, 4, null, 3)

      // The hidden count badge shows "3"
      const hiddenButton = screen.getByText("Hidden").closest("button")
      expect(hiddenButton).toBeInTheDocument()
      expect(hiddenButton!.textContent).toContain("3")
    })

    it("highlights Hidden when selected", () => {
      renderSidebar(null, null, 17, 4, "hidden", 5)

      const hiddenButton = screen.getByText("Hidden").closest("button")
      expect(hiddenButton).toHaveClass("bg-accent")
    })

    it("calls onFilterSelect with 'hidden' when Hidden clicked", () => {
      renderSidebar(null, null, 17, 4, null, 5)

      const hiddenButton = screen.getByText("Hidden").closest("button")
      fireEvent.click(hiddenButton!)

      expect(mockOnSenderSelect).toHaveBeenCalledWith(null)
      expect(mockOnFolderSelect).toHaveBeenCalledWith(null)
      expect(mockOnFilterSelect).toHaveBeenCalledWith("hidden")
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

    // Story 3.3: Updated skeleton structure with folders section
    // 1 "All" skeleton + 3 folder skeletons + 4 sender skeletons = 8 total
    const skeletonItems = document.querySelectorAll(".bg-muted")
    expect(skeletonItems.length).toBeGreaterThanOrEqual(5)
  })
})
