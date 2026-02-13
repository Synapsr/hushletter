import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReaderActionBar } from "./ReaderActionBar";

describe("ReaderActionBar", () => {
  it("shows archive aria label when newsletter is visible", () => {
    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("shows unhide aria label when newsletter is hidden", () => {
    render(
      <ReaderActionBar
        isRead={false}
        isHidden
        isFavorited={false}
        isFavoritePending={false}
        onArchive={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Unhide" })).toBeInTheDocument();
  });

  it("disables archive button while archive mutation is pending", () => {
    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        isArchivePending
        onArchive={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
  });

  it("calls onToggleFavorite when star button is clicked", async () => {
    const onToggleFavorite = vi.fn();

    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={vi.fn()}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    await fireEvent.click(screen.getByRole("button", { name: "Add to favorites" }));
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it("disables star button while favorite mutation is pending", () => {
    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending
        onArchive={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Add to favorites" })).toBeDisabled();
  });

  it("shows pressed state for favorited newsletters", () => {
    render(
      <ReaderActionBar
        isRead
        isHidden={false}
        isFavorited
        isFavoritePending={false}
        onArchive={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Remove from favorites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders appearance controls in popover", async () => {
    render(
      <ReaderActionBar
        isRead
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={vi.fn()}
        onToggleFavorite={vi.fn()}
        preferences={{ background: "mist", font: "sans", fontSize: "medium" }}
        onBackgroundChange={vi.fn()}
        onFontChange={vi.fn()}
        onFontSizeChange={vi.fn()}
      />,
    );

    await fireEvent.click(screen.getByRole("button", { name: "Reader appearance" }));

    expect(screen.getByText("Reader appearance")).toBeInTheDocument();
    expect(screen.getByLabelText("Reader background")).toBeInTheDocument();
    expect(screen.getByLabelText("Reader font")).toBeInTheDocument();
    expect(screen.getByLabelText("Reader font size")).toBeInTheDocument();
  });

  it("renders estimated read time when provided", () => {
    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={vi.fn()}
        onToggleFavorite={vi.fn()}
        estimatedReadMinutes={5}
      />,
    );

    expect(screen.getByText("5 min read")).toBeInTheDocument();
  });

  it("renders less than one minute label when estimate is below one minute", () => {
    render(
      <ReaderActionBar
        isRead={false}
        isHidden={false}
        isFavorited={false}
        isFavoritePending={false}
        onArchive={vi.fn()}
        onToggleFavorite={vi.fn()}
        estimatedReadMinutes={0}
      />,
    );

    expect(screen.getByText("<1 min read")).toBeInTheDocument();
  });
});
