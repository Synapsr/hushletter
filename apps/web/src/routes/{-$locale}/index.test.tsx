import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let mockLocale = "en";

vi.mock("@/paraglide/runtime.js", () => ({
  getLocale: () => mockLocale,
}));

vi.mock("@tanstack/react-router", async () => {
  return {
    createFileRoute: () => (options: unknown) => ({ options }),
    Link: ({ children }: { children: unknown }) => <a>{children}</a>,
  };
});

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: () => ({ queryKey: ["mock"] }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => ({ data: null }),
  };
});

vi.mock("convex/react", () => ({
  useAction: () => vi.fn(async () => ({ url: "https://example.com/checkout" })),
}));

vi.mock("@hushletter/backend", () => ({
  api: {
    auth: { getCurrentUser: "getCurrentUser" },
    billing: { createProCheckoutUrl: "createProCheckoutUrl" },
  },
}));

import { LandingPage } from "./index";

describe("LandingPage pricing section", () => {
  beforeEach(() => {
    // Minimal stubs for hooks used across the landing page.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    // Some environments don't have rAF; landing uses it for counters.
    if (!globalThis.requestAnimationFrame) {
      // @ts-expect-error - test stub
      globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
    }
  });

  it("renders USD pricing for en locale", () => {
    mockLocale = "en";
    render(<LandingPage />);
    expect(screen.getByText("$9/month · $90/year · + tax/VAT where applicable")).toBeTruthy();
  });

  it("renders EUR pricing for fr locale", () => {
    mockLocale = "fr";
    render(<LandingPage />);
    expect(screen.getByText("$9/month · $90/year · + tax/VAT where applicable")).toBeTruthy();
  });
});
