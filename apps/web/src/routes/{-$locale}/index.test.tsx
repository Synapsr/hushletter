import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let mockLocale = "en";

vi.mock("@/paraglide/runtime.js", () => ({
  getLocale: () => mockLocale,
}));

vi.mock("@/paraglide/messages.js", () => {
  const handler: ProxyHandler<object> = {
    get: (_target, prop: string) => {
      return (params?: Record<string, string>) => {
        if (params) {
          return Object.entries(params).reduce(
            (str, [key, val]) => str.replace(`{${key}}`, val),
            prop,
          );
        }
        return prop;
      };
    },
  };
  return { m: new Proxy({}, handler) };
});

vi.mock("@tanstack/react-router", async () => {
  return {
    createFileRoute: () => (options: unknown) => ({ options }),
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
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

import { LandingPricing } from "@/components/landing/landing-pricing";

describe("LandingPricing section", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("renders pricing heading", () => {
    mockLocale = "en";
    render(<LandingPricing />);
    expect(screen.getByText("landing_pricingTitle")).toBeTruthy();
  });

  it("renders pricing for fr locale", () => {
    mockLocale = "fr";
    render(<LandingPricing />);
    expect(screen.getByText("landing_pricingTitle")).toBeTruthy();
  });
});
