import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router");
  return {
    ...actual,
    createFileRoute: () => (options: any) => ({
      options,
      useParams: () => ({ id: "newsletter-1" }),
    }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: () => ({ queryKey: ["mock"] }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
  };
});

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(async () => undefined),
}));

vi.mock("@/hooks/useOptimisticNewsletterFavorite", () => ({
  useOptimisticNewsletterFavorite: () => ({
    getIsFavorited: () => false,
    isFavoritePending: () => false,
    toggleFavorite: vi.fn(async () => undefined),
  }),
}));

vi.mock("@/components/ReaderView", () => ({
  ReaderView: () => <div data-testid="reader-view">Reader</div>,
  clearCacheEntry: vi.fn(),
}));

vi.mock("@/components/SummaryPanel", () => ({
  SummaryPanel: () => <div data-testid="summary-panel">Summary</div>,
}));

vi.mock("@hushletter/backend", () => ({
  api: {
    newsletters: {
      getUserNewsletter: "getUserNewsletter",
      markNewsletterRead: "markNewsletterRead",
      markNewsletterUnread: "markNewsletterUnread",
      hideNewsletter: "hideNewsletter",
      unhideNewsletter: "unhideNewsletter",
      deleteUserNewsletter: "deleteUserNewsletter",
      setNewsletterFavorite: "setNewsletterFavorite",
    },
    share: {
      ensureNewsletterShareToken: "ensureNewsletterShareToken",
    },
  },
}));

describe("/_authed/newsletters/$id paywall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders upgrade CTA when newsletter is locked", async () => {
    mockUseQuery.mockReturnValue({
      data: {
        _id: "newsletter-1",
        subject: "Locked newsletter",
        senderEmail: "sender@example.com",
        senderName: "Sender",
        receivedAt: Date.now(),
        isRead: false,
        isHidden: false,
        isFavorited: false,
        isPrivate: true,
        readProgress: 0,
        contentStatus: "locked",
        source: "email",
      },
      isPending: false,
      error: null,
    });

    const routeModule = await import("./$id");
    const Component = routeModule.Route.options.component!;

    render(<Component />);

    expect(screen.getByText("Upgrade to read this newsletter")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeTruthy();
  });
});

