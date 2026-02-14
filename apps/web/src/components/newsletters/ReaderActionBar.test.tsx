import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReaderActionBar } from "./ReaderActionBar";

describe("ReaderActionBar", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Share newsletter" }));
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});

