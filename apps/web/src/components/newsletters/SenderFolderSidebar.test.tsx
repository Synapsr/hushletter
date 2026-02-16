import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SenderFolderSidebar } from "./SenderFolderSidebar";
import type { NewsletterData } from "@/components/NewsletterCard";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: vi.fn((api, args) => ({ queryKey: [api, args], queryFn: () => {} })),
}));

vi.mock("convex/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/react")>();
  return {
    ...actual,
    useAction: vi.fn(),
  };
});

vi.mock("@hushletter/backend", () => ({
  api: {
    folders: {
      listVisibleFoldersWithUnreadCounts: "folders.listVisibleFoldersWithUnreadCounts",
    },
    newsletters: {
      getUserNewsletter: "newsletters.getUserNewsletter",
      getHiddenNewsletterCount: "newsletters.getHiddenNewsletterCount",
      listRecentUnreadNewslettersHead: "newsletters.listRecentUnreadNewslettersHead",
      listRecentUnreadNewslettersPage: "newsletters.listRecentUnreadNewslettersPage",
    },
  },
}));

vi.mock("./SenderFolderItem", () => ({
  SenderFolderItem: ({
    folder,
    isSelected,
    isExpanded,
    onExpandedChange,
  }: {
    folder: { name: string };
    isSelected: boolean;
    isExpanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
  }) => (
    <button
      type="button"
      data-testid="sender-folder-item"
      data-expanded={isExpanded ? "true" : "false"}
      data-selected={isSelected ? "true" : "false"}
      onClick={() => onExpandedChange(!isExpanded)}
    >
      {folder.name}
    </button>
  ),
}));

vi.mock("./NewsletterListItem", () => ({
  NewsletterListItem: ({
    newsletter,
    enableHideAction,
    onHide,
  }: {
    newsletter: { _id: string; subject: string };
    enableHideAction?: boolean;
    onHide?: (id: string) => void;
  }) => (
    <div data-testid="newsletter-list-item">
      <span>{newsletter.subject}</span>
      {enableHideAction && (
        <button type="button" aria-label="Hide" onClick={() => onHide?.(newsletter._id)}>
          Hide
        </button>
      )}
    </div>
  ),
}));

vi.mock("./SidebarFooter", () => ({
  SidebarFooter: () => null,
}));

import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction } from "convex/react";

const mockUseQuery = vi.mocked(useQuery);
const mockConvexQuery = vi.mocked(convexQuery);
const mockUseAction = vi.mocked(useAction);

let foldersQueryData: unknown[] = [];
let hiddenCountData = 0;
let selectedNewsletterMetaData: unknown = null;
let recentUnreadHeadData: {
  page: NewsletterData[];
  isDone: boolean;
  continueCursor: string | null;
} = {
  page: [],
  isDone: true,
  continueCursor: null,
};

const mockLoadRecentUnreadPage = vi.fn();

type MockObserverInstance = {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};
const mockObserverInstances: MockObserverInstance[] = [];

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    mockObserverInstances.push({
      callback,
      observe: this.observe,
      disconnect: this.disconnect,
    });
  }
}

describe("SenderFolderSidebar", () => {
  const defaultProps = {
    selectedFolderId: null,
    selectedNewsletterId: null,
    selectedFilter: "starred" as const,
    hiddenNewsletters: [] as NewsletterData[],
    hiddenPending: false,
    favoritedNewsletters: [] as NewsletterData[],
    favoritedPending: false,
    onFolderSelect: vi.fn(),
    onNewsletterSelect: vi.fn(),
    onFilterSelect: vi.fn(),
    getIsFavorited: vi.fn(() => false),
    isFavoritePending: vi.fn(() => false),
    onToggleFavorite: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    foldersQueryData = [];
    hiddenCountData = 0;
    selectedNewsletterMetaData = null;
    recentUnreadHeadData = {
      page: [],
      isDone: true,
      continueCursor: null,
    };
    mockLoadRecentUnreadPage.mockResolvedValue({
      page: [],
      isDone: true,
      continueCursor: null,
    });
    mockUseAction.mockReturnValue(mockLoadRecentUnreadPage as never);
    mockObserverInstances.length = 0;

    localStorage.clear();

    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
    });

    mockUseQuery.mockImplementation((options) => {
      const queryKey = options?.queryKey?.[0];
      if (queryKey === "folders.listVisibleFoldersWithUnreadCounts") {
        return {
          data: foldersQueryData,
          isPending: false,
          isError: false,
        } as ReturnType<typeof useQuery>;
      }
      if (queryKey === "newsletters.getHiddenNewsletterCount") {
        return {
          data: hiddenCountData,
          isPending: false,
          isError: false,
        } as ReturnType<typeof useQuery>;
      }
      if (queryKey === "newsletters.getUserNewsletter") {
        return {
          data: selectedNewsletterMetaData,
          isPending: false,
          isError: false,
        } as ReturnType<typeof useQuery>;
      }
      if (queryKey === "newsletters.listRecentUnreadNewslettersHead") {
        return {
          data: recentUnreadHeadData,
          isPending: false,
          isError: false,
        } as ReturnType<typeof useQuery>;
      }
      return {
        data: null,
        isPending: false,
        isError: false,
      } as ReturnType<typeof useQuery>;
    });
  });

  it("shows empty state in starred tab when there are no favorites", () => {
    render(<SenderFolderSidebar {...defaultProps} />);
    expect(screen.getByText("No starred newsletters yet.")).toBeInTheDocument();
  });

  it("renders starred newsletter rows in starred tab", () => {
    const favorites: NewsletterData[] = [
      {
        _id: "id1" as Id<"userNewsletters">,
        subject: "Weekly update",
        senderEmail: "sender@example.com",
        receivedAt: Date.now(),
        isRead: false,
        isHidden: false,
        isPrivate: false,
        isFavorited: true,
      },
    ];

    render(
      <SenderFolderSidebar
        {...defaultProps}
        favoritedNewsletters={favorites}
        getIsFavorited={(_id, serverValue) => Boolean(serverValue)}
      />,
    );

    expect(screen.getByTestId("newsletter-list-item")).toHaveTextContent("Weekly update");
  });

  it("renders hidden newsletter rows when hidden filter is selected", () => {
    const hiddenNewsletters: NewsletterData[] = [
      {
        _id: "hidden1" as Id<"userNewsletters">,
        subject: "Hidden digest",
        senderEmail: "hidden@example.com",
        receivedAt: Date.now(),
        isRead: true,
        isHidden: true,
        isPrivate: false,
        isFavorited: false,
      },
    ];

    render(
      <SenderFolderSidebar
        {...defaultProps}
        selectedFilter="hidden"
        hiddenNewsletters={hiddenNewsletters}
      />,
    );

    expect(screen.getByTestId("newsletter-list-item")).toHaveTextContent("Hidden digest");
  });

  it("renders recent unread section in all tab and excludes read items", () => {
    recentUnreadHeadData = {
      page: [
        {
          _id: "recent-unread-1" as Id<"userNewsletters">,
          subject: "Unread one",
          senderEmail: "sender1@example.com",
          receivedAt: Date.now(),
          isRead: false,
          isHidden: false,
          isPrivate: false,
        },
        {
          _id: "recent-read-1" as Id<"userNewsletters">,
          subject: "Read should not show",
          senderEmail: "sender2@example.com",
          receivedAt: Date.now() - 1000,
          isRead: true,
          isHidden: false,
          isPrivate: false,
        },
      ],
      isDone: true,
      continueCursor: null,
    };

    render(<SenderFolderSidebar {...defaultProps} selectedFilter={null} />);

    expect(screen.getByText("New unread since last visit")).toBeInTheDocument();
    expect(screen.getByText("Unread one")).toBeInTheDocument();
    expect(screen.queryByText("Read should not show")).not.toBeInTheDocument();
  });

  it("dismisses newsletter only from the recent unread section when hide is clicked", async () => {
    recentUnreadHeadData = {
      page: [
        {
          _id: "recent-unread-1" as Id<"userNewsletters">,
          subject: "Dismiss me",
          senderEmail: "sender1@example.com",
          receivedAt: Date.now(),
          isRead: false,
          isHidden: false,
          isPrivate: false,
        },
        {
          _id: "recent-unread-2" as Id<"userNewsletters">,
          subject: "Keep me",
          senderEmail: "sender2@example.com",
          receivedAt: Date.now() - 1000,
          isRead: false,
          isHidden: false,
          isPrivate: false,
        },
      ],
      isDone: true,
      continueCursor: null,
    };

    render(<SenderFolderSidebar {...defaultProps} selectedFilter={null} />);

    expect(screen.getByText("Dismiss me")).toBeInTheDocument();
    expect(screen.getByText("Keep me")).toBeInTheDocument();

    const hideButtons = screen.getAllByRole("button", { name: "Hide" });
    await fireEvent.click(hideButtons[0]);

    expect(screen.queryByText("Dismiss me")).not.toBeInTheDocument();
    expect(screen.getByText("Keep me")).toBeInTheDocument();
    expect(mockLoadRecentUnreadPage).not.toHaveBeenCalled();
  });

  it("does not render recent unread section outside all tab", () => {
    recentUnreadHeadData = {
      page: [
        {
          _id: "recent-unread-1" as Id<"userNewsletters">,
          subject: "Unread one",
          senderEmail: "sender1@example.com",
          receivedAt: Date.now(),
          isRead: false,
          isHidden: false,
          isPrivate: false,
        },
      ],
      isDone: true,
      continueCursor: null,
    };

    const { rerender } = render(
      <SenderFolderSidebar {...defaultProps} selectedFilter={null} />,
    );
    expect(screen.getByText("New unread since last visit")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Unread" }));
    expect(
      screen.queryByText("New unread since last visit"),
    ).not.toBeInTheDocument();

    rerender(<SenderFolderSidebar {...defaultProps} selectedFilter="hidden" />);
    expect(
      screen.queryByText("New unread since last visit"),
    ).not.toBeInTheDocument();
  });

  it("passes lastConnectedAt and initial page size to recent unread head query", async () => {
    localStorage.setItem("hushletter:lastNewslettersVisit", "1700000000000");

    render(<SenderFolderSidebar {...defaultProps} selectedFilter={null} />);

    await waitFor(() => {
      const recentCall = mockConvexQuery.mock.calls.find(
        ([api, args]) =>
          (api as unknown as string) ===
            "newsletters.listRecentUnreadNewslettersHead" &&
          typeof args === "object" &&
          args !== null &&
          "numItems" in args,
      );

      expect(recentCall).toBeDefined();
      expect(recentCall?.[1]).toMatchObject({
        lastConnectedAt: 1700000000000,
        numItems: 8,
      });
    });
  });

  it("triggers infinite loading in recent unread section when sentinel intersects", async () => {
    localStorage.setItem("hushletter:lastNewslettersVisit", "1700000000000");
    recentUnreadHeadData = {
      page: [
        {
          _id: "recent-unread-1" as Id<"userNewsletters">,
          subject: "Unread one",
          senderEmail: "sender1@example.com",
          receivedAt: Date.now(),
          isRead: false,
          isHidden: false,
          isPrivate: false,
        },
      ],
      isDone: false,
      continueCursor: "cursor-1",
    };
    mockLoadRecentUnreadPage.mockResolvedValue({
      page: [],
      isDone: true,
      continueCursor: null,
    });

    render(<SenderFolderSidebar {...defaultProps} selectedFilter={null} />);

    await waitFor(() => {
      expect(mockObserverInstances.length).toBeGreaterThan(0);
      expect(mockObserverInstances[0]?.observe).toHaveBeenCalled();
    });

    await act(async () => {
      for (const observer of mockObserverInstances) {
        observer.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          observer as unknown as IntersectionObserver,
        );
      }
    });

    await waitFor(() => {
      expect(mockLoadRecentUnreadPage).toHaveBeenCalledWith({
        cursor: "cursor-1",
        numItems: 20,
        lastConnectedAt: 1700000000000,
      });
    });
  });

  it("clears hidden filter when hidden button is clicked while already selected", () => {
    const onFilterSelect = vi.fn();

    render(
      <SenderFolderSidebar
        {...defaultProps}
        selectedFilter="hidden"
        onFilterSelect={onFilterSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /hidden/i }));
    expect(onFilterSelect).toHaveBeenCalledWith(null);
  });

  it("keeps folder expansion state when switching from all to starred and back", () => {
    foldersQueryData = [
      {
        _id: "folder-1",
        name: "Product",
        newsletterCount: 3,
        unreadCount: 1,
      },
    ];

    const { rerender } = render(
      <SenderFolderSidebar {...defaultProps} selectedFilter={null} />,
    );

    const folderButton = screen.getByTestId("sender-folder-item");
    expect(folderButton).toHaveAttribute("data-expanded", "false");

    fireEvent.click(folderButton);
    expect(screen.getByTestId("sender-folder-item")).toHaveAttribute(
      "data-expanded",
      "true",
    );

    rerender(<SenderFolderSidebar {...defaultProps} selectedFilter="starred" />);
    rerender(<SenderFolderSidebar {...defaultProps} selectedFilter={null} />);

    expect(screen.getByTestId("sender-folder-item")).toHaveAttribute(
      "data-expanded",
      "true",
    );
  });

  it("highlights the sender row for the selected newsletter when folder search param is absent", () => {
    foldersQueryData = [
      {
        _id: "folder-1",
        name: "Sender One",
        newsletterCount: 3,
        unreadCount: 1,
      },
      {
        _id: "folder-2",
        name: "Sender Two",
        newsletterCount: 2,
        unreadCount: 0,
      },
    ];
    selectedNewsletterMetaData = { folderId: "folder-2" };

    render(
      <SenderFolderSidebar
        {...defaultProps}
        selectedFilter={null}
        selectedFolderId={null}
        selectedNewsletterId={"newsletter-123"}
      />,
    );

    const items = screen.getAllByTestId("sender-folder-item");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Sender One");
    expect(items[0]).toHaveAttribute("data-selected", "false");
    expect(items[1]).toHaveTextContent("Sender Two");
    expect(items[1]).toHaveAttribute("data-selected", "true");
  });
});
