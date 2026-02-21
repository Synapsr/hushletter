import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let mockLocale = "en";
let mockEntitlements: unknown = {
  plan: "free",
  isPro: false,
  proExpiresAt: null,
  unlockedCap: 1000,
  usage: { unlockedStored: 100 },
};
const mockCreateCheckout = vi.fn(async () => ({ url: "https://example.com/checkout" }));
const mockCreatePortal = vi.fn(async () => ({ url: "https://example.com/portal" }));

vi.mock("@/paraglide/runtime.js", () => ({
  getLocale: () => mockLocale,
}));

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: (api: unknown, args: unknown) => ({ queryKey: [api, args] }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => ({ data: mockEntitlements, isPending: false }),
  };
});

vi.mock("convex/react", () => ({
  useAction: (apiFn: unknown) => {
    if (apiFn === "createCustomerPortalUrl") return mockCreatePortal;
    return mockCreateCheckout;
  },
}));

vi.mock("@hushletter/backend", () => ({
  api: {
    entitlements: { getEntitlements: "getEntitlements" },
    billing: {
      createProCheckoutUrl: "createProCheckoutUrl",
      createCustomerPortalUrl: "createCustomerPortalUrl",
    },
  },
}));

vi.mock("@/components/pricing-dialog", () => ({
  PricingDialog: ({
    open,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    returnPath?: string;
    billingSource?: "settings_dialog";
  }) => (open ? <div data-testid="pricing-dialog-mock">Pricing dialog</div> : null),
}));

import { SettingsBilling } from "./settings-billing";

describe("SettingsBilling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocale = "en";
    mockEntitlements = {
      plan: "free",
      isPro: false,
      proExpiresAt: null,
      unlockedCap: 1000,
      usage: { unlockedStored: 100 },
    };
  });

  it("uses a single upgrade trigger and opens the shared pricing dialog", async () => {
    const user = userEvent.setup();
    render(<SettingsBilling />);
    expect(screen.getByRole("button", { name: /upgrade to pro/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /upgrade monthly/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /upgrade yearly/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: /upgrade to pro/i }));
    expect(screen.getByTestId("pricing-dialog-mock")).toBeTruthy();
  });

  it("opens shared pricing dialog for fr locale", async () => {
    const user = userEvent.setup();
    mockLocale = "fr";
    render(<SettingsBilling />);
    await user.click(screen.getByRole("button", { name: /upgrade to pro/i }));
    expect(screen.getByTestId("pricing-dialog-mock")).toBeTruthy();
  });

  it("renders manage subscription for Pro", () => {
    mockEntitlements = {
      plan: "pro",
      isPro: true,
      proExpiresAt: Date.now() + 1000 * 60 * 60 * 24,
      unlockedCap: 1000,
      usage: { unlockedStored: 100 },
    };
    render(<SettingsBilling />);
    expect(screen.getByText("Hushletter Pro")).toBeTruthy();
    expect(screen.getByRole("button", { name: /manage subscription/i })).toBeTruthy();
  });
});
