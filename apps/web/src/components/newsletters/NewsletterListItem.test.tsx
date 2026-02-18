import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { NewsletterListItem } from "./NewsletterListItem";
import type { NewsletterData } from "@/components/NewsletterCard";

describe("NewsletterListItem", () => {
  const newsletter: NewsletterData = {
    _id: "newsletter-1" as Id<"userNewsletters">,
    subject: "Test subject",
    senderEmail: "sender@example.com",
    senderName: "Sender",
    receivedAt: Date.now() - 1000 * 60 * 60,
    isRead: false,
    isHidden: false,
    isPrivate: false,
  };

  it("clicking row triggers newsletter selection", async () => {
    const onClick = vi.fn();
    const onToggleFavorite = vi.fn().mockResolvedValue(undefined);
    render(
      <NewsletterListItem
        newsletter={newsletter}
        isSelected={false}
        isFavorited={false}
        isFavoritePending={false}
        onClick={onClick}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    await fireEvent.click(screen.getByRole("button", { name: /test subject/i }));
    expect(onClick).toHaveBeenCalledWith("newsletter-1");
    expect(onToggleFavorite).not.toHaveBeenCalled();
  });

  it("clicking favorite button toggles favorite without selecting row", async () => {
    const onClick = vi.fn();
    const onToggleFavorite = vi.fn().mockResolvedValue(undefined);
    render(
      <NewsletterListItem
        newsletter={newsletter}
        isSelected={false}
        isFavorited={false}
        isFavoritePending={false}
        onClick={onClick}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to favorites" }));
    });
    expect(onToggleFavorite).toHaveBeenCalledWith("newsletter-1", false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disables favorite button while pending", () => {
    render(
      <NewsletterListItem
        newsletter={newsletter}
        isSelected={false}
        isFavorited={false}
        isFavoritePending
        onClick={vi.fn()}
        onToggleFavorite={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("button", { name: "Add to favorites" })).toBeDisabled();
  });

  it("shows hide button only when enableHideAction is true", () => {
    const { rerender } = render(
      <NewsletterListItem
        newsletter={newsletter}
        isSelected={false}
        isFavorited={false}
        isFavoritePending={false}
        onClick={vi.fn()}
        onToggleFavorite={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByRole("button", { name: "Hide" })).not.toBeInTheDocument();

    rerender(
      <NewsletterListItem
        newsletter={newsletter}
        isSelected={false}
        isFavorited={false}
        isFavoritePending={false}
        enableHideAction
        onClick={vi.fn()}
        onToggleFavorite={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("button", { name: "Hide" })).toBeInTheDocument();
  });

  it("clicking hide button hides newsletter without selecting row", async () => {
    const onClick = vi.fn();
    const onToggleFavorite = vi.fn().mockResolvedValue(undefined);
    const onHide = vi.fn();

    render(
      <NewsletterListItem
        newsletter={newsletter}
        isSelected={false}
        isFavorited={false}
        isFavoritePending={false}
        enableHideAction
        onHide={onHide}
        onClick={onClick}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    await fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(onHide).toHaveBeenCalledWith("newsletter-1");
    expect(onClick).not.toHaveBeenCalled();
    expect(onToggleFavorite).not.toHaveBeenCalled();
  });

  it("calls read/archive/bin handlers from quick actions", async () => {
    const onToggleRead = vi.fn().mockResolvedValue(undefined);
    const onArchive = vi.fn().mockResolvedValue(undefined);
    const onBin = vi.fn().mockResolvedValue(undefined);

    render(
      <NewsletterListItem
        newsletter={newsletter}
        isSelected={false}
        isFavorited={false}
        isFavoritePending={false}
        onClick={vi.fn()}
        onToggleFavorite={vi.fn().mockResolvedValue(undefined)}
        onToggleRead={onToggleRead}
        onArchive={onArchive}
        onBin={onBin}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    });
    await waitFor(() => {
      expect(onToggleRead).toHaveBeenCalledWith("newsletter-1", false);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    });
    await waitFor(() => {
      expect(onArchive).toHaveBeenCalledWith("newsletter-1");
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Bin" }));
    });
    await waitFor(() => {
      expect(onBin).toHaveBeenCalledWith("newsletter-1");
    });
  });

  it("calls unarchive handler for hidden newsletters", async () => {
    const hiddenNewsletter: NewsletterData = {
      ...newsletter,
      isHidden: true,
    };
    const onUnarchive = vi.fn().mockResolvedValue(undefined);

    render(
      <NewsletterListItem
        newsletter={hiddenNewsletter}
        isSelected={false}
        isFavorited={false}
        isFavoritePending={false}
        onClick={vi.fn()}
        onToggleFavorite={vi.fn().mockResolvedValue(undefined)}
        onUnarchive={onUnarchive}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Unhide" }));
    });

    await waitFor(() => {
      expect(onUnarchive).toHaveBeenCalledWith("newsletter-1");
    });
  });
});
