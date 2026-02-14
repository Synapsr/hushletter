import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShareDedicatedEmailPage } from "./$token";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router");
  return {
    ...actual,
    createFileRoute: () => (options: unknown) => ({ options }),
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: vi.fn(() => ({ queryKey: ["mock-query"] })),
}));

vi.mock("@hushletter/backend", () => ({
  api: {
    share: {
      getDedicatedEmailByShareToken: "getDedicatedEmailByShareToken",
    },
  },
}));

describe("/share/$token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders only the dedicated email when token resolves", () => {
    mockUseQuery.mockReturnValue({
      data: { dedicatedEmail: "user123@newsletters.example.com" },
      isPending: false,
    });

    render(<ShareDedicatedEmailPage token="token-123" />);

    expect(
      screen.getByRole("button", { name: "user123@newsletters.example.com" }),
    ).toBeInTheDocument();
  });

  it("renders minimal not-found when token is invalid", () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isPending: false,
    });

    render(<ShareDedicatedEmailPage token="bad-token" />);

    expect(screen.getByText("Not found")).toBeInTheDocument();
  });
});

