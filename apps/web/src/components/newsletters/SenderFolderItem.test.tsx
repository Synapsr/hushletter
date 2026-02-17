import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { SenderFolderItem } from "./SenderFolderItem";
import type { FolderData } from "@/components/FolderSidebar";

vi.mock("convex/react", () => ({
  useAction: vi.fn(() => vi.fn()),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({
    data: [],
    isPending: false,
  })),
}));

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: vi.fn((api, args) => ({ queryKey: [api, args], queryFn: () => {} })),
}));

vi.mock("@hushletter/backend", () => ({
  api: {
    newsletters: {
      listUserNewslettersByFolder: "newsletters.listUserNewslettersByFolder",
    },
  },
}));

vi.mock("@/components/FolderActionsDropdown", () => ({
  FolderActionsDropdown: () => null,
}));

vi.mock("./NewsletterListItem", () => ({
  NewsletterListItem: () => null,
}));

describe("SenderFolderItem", () => {
  const folder: FolderData = {
    _id: "folder-1" as Id<"folders">,
    userId: "user-1",
    name: "DENG",
    senderCount: 1,
    newsletterCount: 2,
    unreadCount: 1,
    isHidden: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it("expands without selecting folder, then selects on row click", async () => {
    const onFolderSelect = vi.fn();

    render(
      <SenderFolderItem
        folder={folder}
        isSelected={false}
        selectedNewsletterId={null}
        sidebarFilter="all"
        isExpanded={false}
        onExpandedChange={vi.fn()}
        onFolderSelect={onFolderSelect}
        onNewsletterSelect={vi.fn()}
        getIsFavorited={vi.fn(() => false)}
        isFavoritePending={vi.fn(() => false)}
        onToggleFavorite={vi.fn().mockResolvedValue(undefined)}
        onToggleRead={vi.fn().mockResolvedValue(undefined)}
        onArchive={vi.fn().mockResolvedValue(undefined)}
        onBin={vi.fn().mockResolvedValue(undefined)}
        onHideSuccess={vi.fn()}
      />,
    );

    const folderSelectButton = screen.getByText("DENG").closest("button");
    expect(folderSelectButton).not.toBeNull();

    const expandButton = screen
      .getAllByRole("button")
      .find((button) => button !== folderSelectButton);
    expect(expandButton).toBeDefined();

    await fireEvent.click(expandButton!);
    expect(onFolderSelect).not.toHaveBeenCalled();

    await fireEvent.click(folderSelectButton!);
    expect(onFolderSelect).toHaveBeenCalledWith("folder-1");
  });
});
