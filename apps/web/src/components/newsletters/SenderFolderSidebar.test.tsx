import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
      getHiddenNewsletterCount: "newsletters.getHiddenNewsletterCount",
    },
  },
}));

vi.mock("./SenderFolderItem", () => ({
  SenderFolderItem: ({ folder }: { folder: { name: string } }) => (
    <div data-testid="sender-folder-item">{folder.name}</div>
  ),
}));

vi.mock("./NewsletterListItem", () => ({
  NewsletterListItem: ({ newsletter }: { newsletter: { subject: string } }) => (
    <div data-testid="starred-newsletter-item">{newsletter.subject}</div>
  ),
}));

import { useQuery } from "@tanstack/react-query";

const mockUseQuery = vi.mocked(useQuery);

describe("SenderFolderSidebar", () => {
  const defaultProps = {
    selectedFolderId: null,
    selectedNewsletterId: null,
    selectedFilter: "starred" as const,
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
    mockUseQuery.mockImplementation((options) => {
      const queryKey = options?.queryKey?.[0];
      if (queryKey === "folders.listVisibleFoldersWithUnreadCounts") {
        return {
          data: [],
          isPending: false,
          isError: false,
        } as ReturnType<typeof useQuery>;
      }
      if (queryKey === "newsletters.getHiddenNewsletterCount") {
        return {
          data: 0,
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

    expect(screen.getByTestId("starred-newsletter-item")).toHaveTextContent("Weekly update");
  });
});
