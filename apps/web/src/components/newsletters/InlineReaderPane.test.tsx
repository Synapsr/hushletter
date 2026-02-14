import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { m } from "@/paraglide/messages.js";
import { InlineReaderPane } from "./InlineReaderPane";

const mockUseQuery = vi.fn();
const mockHideNewsletter = vi.fn();
const mockUnhideNewsletter = vi.fn();
const mockMarkRead = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: vi.fn(() => ({ queryKey: ["mock-query"] })),
}));

vi.mock("@hushletter/backend", () => ({
  api: {
    newsletters: {
      getUserNewsletter: "getUserNewsletter",
      hideNewsletter: "hideNewsletter",
      unhideNewsletter: "unhideNewsletter",
      markNewsletterRead: "markNewsletterRead",
    },
    share: {
      ensureDedicatedEmailShareToken: "ensureDedicatedEmailShareToken",
      rotateDedicatedEmailShareToken: "rotateDedicatedEmailShareToken",
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: (mutationRef: string) => {
    if (mutationRef === "hideNewsletter") return mockHideNewsletter;
    if (mutationRef === "unhideNewsletter") return mockUnhideNewsletter;
    if (mutationRef === "markNewsletterRead") return mockMarkRead;
    return vi.fn();
  },
}));

vi.mock("@/components/ReaderView", () => ({
  ReaderView: () => <div data-testid="reader-view">Reader</div>,
  clearCacheEntry: vi.fn(),
}));

vi.mock("@/hooks/useReaderPreferences", () => ({
  useReaderPreferences: () => ({
    preferences: { background: "mist", font: "sans", fontSize: "medium" },
    setBackground: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
  }),
  READER_BACKGROUND_OPTIONS: {
    mist: { label: "Mist", color: "#f4f5f6" },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("./ReaderActionBar", () => ({
  ReaderActionBar: ({
    onArchive,
    isHidden,
    isArchivePending,
  }: {
    onArchive: () => void;
    isHidden: boolean;
    isArchivePending?: boolean;
  }) => (
    <button type="button" onClick={onArchive} disabled={Boolean(isArchivePending)}>
      {isHidden ? "Unhide" : "Archive"}
    </button>
  ),
}));

const baseNewsletter = {
  _id: "newsletter-1",
  subject: "Weekly digest",
  senderEmail: "sender@example.com",
  senderName: "Sender",
  receivedAt: Date.now(),
  isRead: false,
  isHidden: false,
  isFavorited: false,
  isPrivate: true,
  readProgress: 0,
  contentStatus: "available" as const,
  source: "email" as const,
};

function renderPane(overrides?: Partial<typeof baseNewsletter>) {
  mockUseQuery.mockReturnValue({
    data: { ...baseNewsletter, ...overrides },
    isPending: false,
  });

  return render(
    <InlineReaderPane
      newsletterId={"newsletter-1" as Id<"userNewsletters">}
      getIsFavorited={vi.fn(() => false)}
      isFavoritePending={vi.fn(() => false)}
      onToggleFavorite={vi.fn().mockResolvedValue(undefined)}
    />,
  );
}

describe("InlineReaderPane archive/unarchive flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockHideNewsletter.mockResolvedValue(undefined);
    mockUnhideNewsletter.mockResolvedValue(undefined);
    mockMarkRead.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("archives visible newsletter and shows 5-second cancel toast", async () => {
    renderPane({ isHidden: false });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    });

    await waitFor(() => {
      expect(mockHideNewsletter).toHaveBeenCalledWith({
        userNewsletterId: "newsletter-1",
      });
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      m.newsletters_newsletterHidden(),
      expect.objectContaining({
        duration: 5000,
        action: expect.objectContaining({
          label: m.common_cancel(),
          onClick: expect.any(Function),
        }),
      }),
    );
  });

  it("undo action from archive toast restores the newsletter", async () => {
    renderPane({ isHidden: false });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    });

    const toastOptions = mockToastSuccess.mock.calls[0]?.[1] as
      | { action?: { onClick?: () => void } }
      | undefined;
    await act(async () => {
      toastOptions?.action?.onClick?.();
    });

    await waitFor(() => {
      expect(mockUnhideNewsletter).toHaveBeenCalledWith({
        userNewsletterId: "newsletter-1",
      });
    });
  });

  it("unhides directly when newsletter is already hidden", async () => {
    renderPane({ isHidden: true });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Unhide" }));
    });

    await waitFor(() => {
      expect(mockUnhideNewsletter).toHaveBeenCalledWith({
        userNewsletterId: "newsletter-1",
      });
    });
    expect(mockHideNewsletter).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("shows hide error toast when archive mutation fails", async () => {
    mockHideNewsletter.mockRejectedValueOnce(new Error("hide failed"));
    renderPane({ isHidden: false });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(m.newsletters_failedToHide());
    });
  });

  it("shows restore error toast when unhide mutation fails", async () => {
    mockUnhideNewsletter.mockRejectedValueOnce(new Error("unhide failed"));
    renderPane({ isHidden: true });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Unhide" }));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(m.newsletters_failedToRestore());
    });
  });
});
