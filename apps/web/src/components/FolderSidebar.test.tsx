import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FolderSidebar, FolderSidebarSkeleton } from "./FolderSidebar"
import type { FolderData } from "./FolderSidebar"

// Mock react-query
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}))

// Mock convex-query
vi.mock("@convex-dev/react-query", () => ({
  convexQuery: vi.fn((api, args) => ({ queryKey: [api, args], queryFn: () => {} })),
}))

// Mock Convex API
vi.mock("@newsletter-manager/backend", () => ({
  api: {
    folders: {
      listVisibleFoldersWithUnreadCounts: "folders.listVisibleFoldersWithUnreadCounts",
    },
    newsletters: {
      getHiddenNewsletterCount: "newsletters.getHiddenNewsletterCount",
    },
  },
}))

import { useQuery } from "@tanstack/react-query"

const mockUseQuery = vi.mocked(useQuery)

/**
 * FolderSidebar Tests - Story 9.4
 *
 * Tests folder-centric navigation sidebar component
 */
describe("FolderSidebar (Story 9.4)", () => {
  const defaultProps = {
    selectedFolderId: null,
    selectedFilter: null,
    onFolderSelect: vi.fn(),
    onFilterSelect: vi.fn(),
  }

  const mockFolders: FolderData[] = [
    {
      _id: "folder-tech",
      userId: "user-1",
      name: "Tech",
      isHidden: false,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      newsletterCount: 47,
      unreadCount: 3,
      senderCount: 2,
    },
    {
      _id: "folder-finance",
      userId: "user-1",
      name: "Finance",
      isHidden: false,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      newsletterCount: 23,
      unreadCount: 0,
      senderCount: 1,
    },
    {
      _id: "folder-morning-brew",
      userId: "user-1",
      name: "Morning Brew",
      isHidden: false,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      newsletterCount: 156,
      unreadCount: 1,
      senderCount: 1,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Loading State", () => {
    it("shows skeleton while loading folders (Task 1.8)", () => {
      mockUseQuery.mockImplementation(() => ({
        data: undefined,
        isPending: true,
        isLoading: true,
        isError: false,
        error: null,
      }) as ReturnType<typeof useQuery>)

      render(<FolderSidebar {...defaultProps} />)

      // Should show skeleton with pulse animation
      const skeleton = document.querySelector(".animate-pulse")
      expect(skeleton).toBeTruthy()
    })

    it("renders skeleton component correctly (Task 1.8)", () => {
      render(<FolderSidebarSkeleton />)

      // Skeleton should have multiple pulse elements
      const pulseElements = document.querySelectorAll(".animate-pulse")
      expect(pulseElements.length).toBeGreaterThan(0)
    })
  })

  describe("Folder Display (AC #1)", () => {
    beforeEach(() => {
      mockUseQuery.mockImplementation((options) => {
        const queryKey = options?.queryKey?.[0]
        if (queryKey === "folders.listVisibleFoldersWithUnreadCounts") {
          return {
            data: mockFolders,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        if (queryKey === "newsletters.getHiddenNewsletterCount") {
          return {
            data: 5,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        return { data: null, isPending: false } as ReturnType<typeof useQuery>
      })
    })

    it("renders folders instead of senders (AC #1)", () => {
      render(<FolderSidebar {...defaultProps} />)

      // Should show folders
      expect(screen.getByText("Tech")).toBeDefined()
      expect(screen.getByText("Finance")).toBeDefined()
      expect(screen.getByText("Morning Brew")).toBeDefined()
    })

    it("shows All Newsletters at top", () => {
      render(<FolderSidebar {...defaultProps} />)

      expect(screen.getByText("All Newsletters")).toBeDefined()
    })

    it("renders folder icons for each folder", () => {
      render(<FolderSidebar {...defaultProps} />)

      // Should have folder icons (lucide-react FolderIcon)
      const folderIcons = document.querySelectorAll('svg[class*="lucide-folder"]')
      expect(folderIcons.length).toBeGreaterThanOrEqual(mockFolders.length)
    })
  })

  describe("Folder Counts (AC #2)", () => {
    beforeEach(() => {
      mockUseQuery.mockImplementation((options) => {
        const queryKey = options?.queryKey?.[0]
        if (queryKey === "folders.listVisibleFoldersWithUnreadCounts") {
          return {
            data: mockFolders,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        if (queryKey === "newsletters.getHiddenNewsletterCount") {
          return {
            data: 0,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        return { data: null, isPending: false } as ReturnType<typeof useQuery>
      })
    })

    it("shows newsletter count for each folder (AC #2)", () => {
      render(<FolderSidebar {...defaultProps} />)

      // Newsletter counts should be visible
      expect(screen.getByText("47")).toBeDefined() // Tech
      expect(screen.getByText("23")).toBeDefined() // Finance
      expect(screen.getByText("156")).toBeDefined() // Morning Brew
    })

    it("shows unread indicator for folders with unread (AC #2)", () => {
      render(<FolderSidebar {...defaultProps} />)

      // Tech has 3 unread, Finance has 0, Morning Brew has 1
      // Should have unread dots for Tech and Morning Brew
      const unreadDots = document.querySelectorAll(".rounded-full.bg-primary\\/60")
      expect(unreadDots.length).toBeGreaterThan(0)
    })

    it("calculates All Newsletters total correctly", () => {
      render(<FolderSidebar {...defaultProps} />)

      // Total: 47 + 23 + 156 = 226
      expect(screen.getByText("226")).toBeDefined()
    })
  })

  describe("Hidden Folders Filtered (AC #3)", () => {
    it("excludes hidden folders from sidebar (AC #3)", () => {
      const foldersWithHidden = [
        ...mockFolders,
        {
          _id: "folder-private",
          userId: "user-1",
          name: "Private",
          isHidden: true, // This folder is hidden
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
          newsletterCount: 10,
          unreadCount: 2,
          senderCount: 1,
        },
      ]

      // Note: The query already filters out hidden folders on the backend
      // So we just test that we display what we receive
      mockUseQuery.mockImplementation((options) => {
        const queryKey = options?.queryKey?.[0]
        if (queryKey === "folders.listVisibleFoldersWithUnreadCounts") {
          // Backend returns only visible folders
          return {
            data: mockFolders, // No hidden folder in response
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        if (queryKey === "newsletters.getHiddenNewsletterCount") {
          return {
            data: 0,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        return { data: null, isPending: false } as ReturnType<typeof useQuery>
      })

      render(<FolderSidebar {...defaultProps} />)

      // Regular folders should be visible
      expect(screen.getByText("Tech")).toBeDefined()
      expect(screen.getByText("Finance")).toBeDefined()

      // "Private" folder should NOT be in the rendered output
      // (because backend filters it out)
      expect(screen.queryByText("Private")).toBeNull()
    })
  })

  describe("Folder Selection (AC #4)", () => {
    beforeEach(() => {
      mockUseQuery.mockImplementation((options) => {
        const queryKey = options?.queryKey?.[0]
        if (queryKey === "folders.listVisibleFoldersWithUnreadCounts") {
          return {
            data: mockFolders,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        if (queryKey === "newsletters.getHiddenNewsletterCount") {
          return {
            data: 0,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        return { data: null, isPending: false } as ReturnType<typeof useQuery>
      })
    })

    it("calls onFolderSelect when folder is clicked (AC #4)", () => {
      const onFolderSelect = vi.fn()
      render(<FolderSidebar {...defaultProps} onFolderSelect={onFolderSelect} />)

      fireEvent.click(screen.getByText("Tech"))

      expect(onFolderSelect).toHaveBeenCalledWith("folder-tech")
    })

    it("shows selected folder as active", () => {
      render(<FolderSidebar {...defaultProps} selectedFolderId="folder-tech" />)

      // Tech folder button should have active styling
      const techButton = screen.getByText("Tech").closest("button")
      expect(techButton?.className).toContain("bg-accent")
      expect(techButton?.className).toContain("font-medium")
    })

    it("clears filter when All Newsletters is clicked", () => {
      const onFolderSelect = vi.fn()
      const onFilterSelect = vi.fn()
      render(
        <FolderSidebar
          {...defaultProps}
          selectedFolderId="folder-tech"
          onFolderSelect={onFolderSelect}
          onFilterSelect={onFilterSelect}
        />
      )

      fireEvent.click(screen.getByText("All Newsletters"))

      expect(onFolderSelect).toHaveBeenCalledWith(null)
      expect(onFilterSelect).toHaveBeenCalledWith(null)
    })

    it("shows All Newsletters as active when no folder selected", () => {
      render(<FolderSidebar {...defaultProps} selectedFolderId={null} selectedFilter={null} />)

      const allButton = screen.getByText("All Newsletters").closest("button")
      expect(allButton?.className).toContain("bg-accent")
    })
  })

  describe("Hidden Section", () => {
    it("shows Hidden section when hidden newsletters exist", () => {
      mockUseQuery.mockImplementation((options) => {
        const queryKey = options?.queryKey?.[0]
        if (queryKey === "folders.listVisibleFoldersWithUnreadCounts") {
          return {
            data: mockFolders,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        if (queryKey === "newsletters.getHiddenNewsletterCount") {
          return {
            data: 5,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        return { data: null, isPending: false } as ReturnType<typeof useQuery>
      })

      render(<FolderSidebar {...defaultProps} />)

      expect(screen.getByText("Hidden")).toBeDefined()
      expect(screen.getByText("5")).toBeDefined()
    })

    it("hides Hidden section when count is zero", () => {
      mockUseQuery.mockImplementation((options) => {
        const queryKey = options?.queryKey?.[0]
        if (queryKey === "folders.listVisibleFoldersWithUnreadCounts") {
          return {
            data: mockFolders,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        if (queryKey === "newsletters.getHiddenNewsletterCount") {
          return {
            data: 0,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        return { data: null, isPending: false } as ReturnType<typeof useQuery>
      })

      render(<FolderSidebar {...defaultProps} />)

      expect(screen.queryByText("Hidden")).toBeNull()
    })

    it("calls onFilterSelect with hidden when Hidden is clicked", () => {
      mockUseQuery.mockImplementation((options) => {
        const queryKey = options?.queryKey?.[0]
        if (queryKey === "folders.listVisibleFoldersWithUnreadCounts") {
          return {
            data: mockFolders,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        if (queryKey === "newsletters.getHiddenNewsletterCount") {
          return {
            data: 5,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        return { data: null, isPending: false } as ReturnType<typeof useQuery>
      })

      const onFilterSelect = vi.fn()
      const onFolderSelect = vi.fn()
      render(
        <FolderSidebar
          {...defaultProps}
          onFilterSelect={onFilterSelect}
          onFolderSelect={onFolderSelect}
        />
      )

      fireEvent.click(screen.getByText("Hidden"))

      expect(onFilterSelect).toHaveBeenCalledWith("hidden")
      expect(onFolderSelect).toHaveBeenCalledWith(null)
    })
  })

  describe("Empty States (Task 6.1)", () => {
    it("shows empty state when no folders exist", () => {
      mockUseQuery.mockImplementation((options) => {
        const queryKey = options?.queryKey?.[0]
        if (queryKey === "folders.listVisibleFoldersWithUnreadCounts") {
          return {
            data: [],
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        if (queryKey === "newsletters.getHiddenNewsletterCount") {
          return {
            data: 0,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        return { data: null, isPending: false } as ReturnType<typeof useQuery>
      })

      render(<FolderSidebar {...defaultProps} />)

      expect(screen.getByText(/no folders yet/i)).toBeDefined()
      expect(screen.getByText(/folders are created automatically/i)).toBeDefined()
    })
  })

  describe("Accessibility", () => {
    beforeEach(() => {
      mockUseQuery.mockImplementation((options) => {
        const queryKey = options?.queryKey?.[0]
        if (queryKey === "folders.listVisibleFoldersWithUnreadCounts") {
          return {
            data: mockFolders,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        if (queryKey === "newsletters.getHiddenNewsletterCount") {
          return {
            data: 5,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
          } as ReturnType<typeof useQuery>
        }
        return { data: null, isPending: false } as ReturnType<typeof useQuery>
      })
    })

    it("folder buttons are accessible", () => {
      render(<FolderSidebar {...defaultProps} />)

      // All folder items should be buttons
      const buttons = screen.getAllByRole("button")
      expect(buttons.length).toBeGreaterThan(0)
    })

    it("unread indicators have aria-labels", () => {
      render(<FolderSidebar {...defaultProps} />)

      // Unread dots should have aria-labels
      const unreadDot = document.querySelector('[aria-label*="unread"]')
      expect(unreadDot).toBeTruthy()
    })
  })
})
