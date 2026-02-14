import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ShareNewsletterPage } from "./$token";

const mockGet = vi.fn();

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router");
  return {
    ...actual,
    createFileRoute: () => (options: unknown) => ({ options }),
  };
});

vi.mock("convex/react", () => ({
  useAction: () => mockGet,
}));

vi.mock("@hushletter/backend", () => ({
  api: {
    share: {
      getNewsletterByShareTokenWithContent: "getNewsletterByShareTokenWithContent",
    },
  },
}));

vi.mock("@/hooks/useReaderPreferences", () => ({
  useReaderPreferences: () => ({
    preferences: { background: "mist", font: "sans", fontSize: "medium" },
  }),
  READER_BACKGROUND_OPTIONS: {
    mist: { label: "Mist", color: "#ffffff" },
  },
}));

vi.mock("@/components/ReaderView", () => ({
  buildReaderDocument: (raw: string) => `<!doctype html><html><body>${raw}</body></html>`,
  withReaderDisplayOverrides: (doc: string) => doc,
}));

describe("/share/$token (newsletter content)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "<p>Hello</p>",
      })),
    );
  });

  it("renders shared newsletter subject + iframe when token resolves", async () => {
    mockGet.mockResolvedValueOnce({
      subject: "Weekly Digest",
      senderEmail: "sender@example.com",
      senderName: "Sender",
      receivedAt: Date.now(),
      contentUrl: "https://example.com/content",
      contentStatus: "available",
    });

    render(<ShareNewsletterPage token="token-123" />);

    await waitFor(() => {
      expect(screen.getByText("Weekly Digest")).toBeInTheDocument();
    });
    expect(screen.getByTitle("Shared newsletter")).toBeInTheDocument();
  });

  it("renders minimal not-found when token is invalid", async () => {
    mockGet.mockResolvedValueOnce(null);

    render(<ShareNewsletterPage token="bad-token" />);

    await waitFor(() => {
      expect(screen.getByText("Not found")).toBeInTheDocument();
    });
  });
});

