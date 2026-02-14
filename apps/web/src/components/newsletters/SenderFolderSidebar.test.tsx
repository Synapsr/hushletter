import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SenderFolderSidebar } from "./SenderFolderSidebar";
import type { NewsletterData } from "@/components/NewsletterCard";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: vi.fn((api, args) => ({ queryKey: [api, args], queryFn: () => {} })),
}));

vi.mock("@hushletter/backend", () => ({
  api: {
    folders: {
      listVisibleFoldersWithUnreadCounts: "folders.listVisibleFoldersWithUnreadCounts",
    },
    newsletters: {
      getUserNewsletter: "newsletters.getUserNewsletter",
      getHiddenNewsletterCount: "newsletters.getHiddenNewsletterCount",
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
  NewsletterListItem: ({ newsletter }: { newsletter: { subject: string } }) => (
    <div data-testid="newsletter-list-item">{newsletter.subject}</div>
  ),
}));

import { useQuery } from "@tanstack/react-query";

const mockUseQuery = vi.mocked(useQuery);
let foldersQueryData: unknown[] = [];
let hiddenCountData = 0;
let selectedNewsletterMetaData: unknown = null;

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
