import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import type { ComponentProps } from "react";
import { m } from "@/paraglide/messages.js";
import { InlineReaderPane } from "./InlineReaderPane";

const mockUseQuery = vi.fn();
const mockUseQueryClient = vi.fn(() => ({
  removeQueries: vi.fn(),
}));
const mockHideNewsletter = vi.fn();
const mockUnhideNewsletter = vi.fn();
const mockMarkRead = vi.fn();
const mockMarkUnread = vi.fn();
const mockBinNewsletter = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => mockUseQueryClient(),
}));

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: (queryRef: string) => ({ queryKey: [queryRef] }),
}));

vi.mock("@hushletter/backend", () => ({
  api: {
    entitlements: {
      getEntitlements: "getEntitlements",
    },
    newsletters: {
      getUserNewsletter: "getUserNewsletter",
      hideNewsletter: "hideNewsletter",
      unhideNewsletter: "unhideNewsletter",
      markNewsletterRead: "markNewsletterRead",
      markNewsletterUnread: "markNewsletterUnread",
      binNewsletter: "binNewsletter",
    },
    share: {
      ensureNewsletterShareToken: "ensureNewsletterShareToken",
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: (mutationRef: string) => {
    if (mutationRef === "hideNewsletter") return mockHideNewsletter;
    if (mutationRef === "unhideNewsletter") return mockUnhideNewsletter;
    if (mutationRef === "markNewsletterRead") return mockMarkRead;
    if (mutationRef === "markNewsletterUnread") return mockMarkUnread;
    if (mutationRef === "binNewsletter") return mockBinNewsletter;
    return vi.fn();
  },
}));

vi.mock("@/components/ReaderView", () => ({
  ReaderView: () => <div data-testid="reader-view">Reader</div>,
  clearCacheEntry: vi.fn(),
}));

vi.mock("@/components/pricing-dialog", () => ({
  PricingDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="pricing-dialog-mock">Pricing dialog</div> : null,
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

type NewsletterMetadata = {
  _id: string;
  subject: string;
  senderEmail: string;
  senderName: string;
  receivedAt: number;
  isRead: boolean;
  isHidden: boolean;
  isFavorited: boolean;
  isPrivate: boolean;
  readProgress: number;
  contentStatus: "available" | "missing" | "error" | "locked";
  source: "email" | "gmail" | "manual" | "community";
};

const baseNewsletter: NewsletterMetadata = {
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

function renderPane(
  overrides?: Partial<NewsletterMetadata>,
  props?: Partial<ComponentProps<typeof InlineReaderPane>>,
) {
  mockUseQuery.mockImplementation((query: any) => {
    const key = query?.queryKey?.[0];
    if (key === "getEntitlements") {
      return { data: { isPro: false }, isPending: false };
    }
    return {
      data: { ...baseNewsletter, ...overrides },
      isPending: false,
    };
  });

  return render(
    <InlineReaderPane
      newsletterId={"newsletter-1" as Id<"userNewsletters">}
      getIsFavorited={vi.fn(() => false)}
      isFavoritePending={vi.fn(() => false)}
      onToggleFavorite={vi.fn().mockResolvedValue(undefined)}
      {...props}
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
    mockMarkUnread.mockResolvedValue(undefined);
    mockBinNewsletter.mockResolvedValue(undefined);
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

  it("shows upgrade paywall for locked newsletters", async () => {
    renderPane({ contentStatus: "locked" as const });
    expect(screen.getByText("Upgrade to read this newsletter")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    expect(screen.getByTestId("pricing-dialog-mock")).toBeTruthy();
  });

  it("closes inline reader when close button is clicked", async () => {
    const onClose = vi.fn();
    renderPane(undefined, { onClose });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Close inline reader pane" }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes inline reader on Escape hotkey", () => {
    const onClose = vi.fn();
    renderPane(undefined, { onClose });

    act(() => {
      document.body.focus();
      fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
