import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReaderActionBar } from "./ReaderActionBar";

describe("ReaderActionBar", () => {
  it("calls fullscreen and next handlers, and keeps previous disabled when unavailable", () => {
    const onOpenFullscreen = vi.fn();
    const onPrevious = vi.fn();
    const onNext = vi.fn();

    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={() => {}}
        onToggleFavorite={() => {}}
        onOpenFullscreen={onOpenFullscreen}
        canGoPrevious={false}
        canGoNext={true}
        onPrevious={onPrevious}
        onNext={onNext}
        senderName="Sender"
        subject="Subject"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open fullscreen reader" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next newsletter" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Previous newsletter" }),
    );

    expect(onOpenFullscreen).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).not.toHaveBeenCalled();
  });

  it("shows exit fullscreen action when already fullscreen", () => {
    const onOpenFullscreen = vi.fn();

    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={() => {}}
        onToggleFavorite={() => {}}
        onOpenFullscreen={onOpenFullscreen}
        isFullscreen={true}
        senderName="Sender"
        subject="Subject"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Exit fullscreen reader" }),
    );
    expect(onOpenFullscreen).toHaveBeenCalledTimes(1);
  });

  it("calls onShare when share button is clicked", () => {
    const onShare = vi.fn();

    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={() => {}}
        onToggleFavorite={() => {}}
        onShare={onShare}
        senderName="Sender"
        subject="Subject"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("calls mark unread and bin handlers from actions menu when newsletter is read", () => {
    const onToggleRead = vi.fn();
    const onBin = vi.fn();

    render(
      <ReaderActionBar
        isRead={true}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={() => {}}
        onToggleFavorite={() => {}}
        onToggleRead={onToggleRead}
        onBin={onBin}
        senderName="Sender"
        subject="Subject"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark unread" }));
    fireEvent.click(screen.getByRole("button", { name: "Bin" }));

    expect(onToggleRead).toHaveBeenCalledTimes(1);
    expect(onBin).toHaveBeenCalledTimes(1);
  });

  it("shows mark as read action when newsletter is unread", () => {
    const onToggleRead = vi.fn();

    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={() => {}}
        onToggleFavorite={() => {}}
        onToggleRead={onToggleRead}
        senderName="Sender"
        subject="Subject"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark as read" }));

    expect(onToggleRead).toHaveBeenCalledTimes(1);
  });

  it("shows restore read-time action when estimate is hidden", () => {
    const onShowReadEstimate = vi.fn();

    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={() => {}}
        onToggleFavorite={() => {}}
        isReadEstimateHidden={true}
        onShowReadEstimate={onShowReadEstimate}
        senderName="Sender"
        subject="Subject"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Show read time" }));

    expect(onShowReadEstimate).toHaveBeenCalledTimes(1);
  });

  it("does not show restore read-time action when estimate is visible", () => {
    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={() => {}}
        onToggleFavorite={() => {}}
        senderName="Sender"
        subject="Subject"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("menuitem", { name: "Show read time" })).toBeNull();
  });

  it("disables read toggle action when callback is missing", () => {
    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={() => {}}
        onToggleFavorite={() => {}}
        senderName="Sender"
        subject="Subject"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Mark as read" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("disables unsubscribe and reply actions as coming soon", () => {
    render(
      <ReaderActionBar
        isRead={true}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={() => {}}
        onToggleFavorite={() => {}}
        onToggleRead={() => {}}
        senderName="Sender"
        subject="Subject"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.getByRole("menuitem", { name: "Unsubscribe (coming soon)" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("menuitem", { name: "Reply (coming soon)" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
