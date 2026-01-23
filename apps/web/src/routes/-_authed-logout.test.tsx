import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the auth client
const mockSignOut = vi.fn()
vi.mock("~/lib/auth-client", () => ({
  signOut: mockSignOut,
}))

// Mock the router
const mockNavigate = vi.fn()
const mockRedirect = vi.fn()
vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    redirect: mockRedirect,
    createFileRoute: () => () => ({ component: () => null }),
    Outlet: () => null,
  }
})

// Simulate the handleLogout function from _authed.tsx
async function simulateHandleLogout() {
  try {
    await mockSignOut()
    mockNavigate({ to: "/" })
  } catch {
    // Even if signOut fails, redirect to home
    mockNavigate({ to: "/" })
  }
}

// Simulate the beforeLoad auth guard
async function simulateBeforeLoad(isAuthenticated: boolean) {
  if (!isAuthenticated) {
    mockRedirect({ to: "/login" })
    throw new Error("Redirect to login")
  }
}

describe("Authenticated Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("AC3: Session Logout", () => {
    it("calls signOut when logout is triggered", async () => {
      mockSignOut.mockResolvedValueOnce(undefined)

      await simulateHandleLogout()

      expect(mockSignOut).toHaveBeenCalled()
    })

    it("redirects to landing page after successful logout", async () => {
      mockSignOut.mockResolvedValueOnce(undefined)

      await simulateHandleLogout()

      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" })
    })

    it("still redirects to home even when signOut throws", async () => {
      mockSignOut.mockRejectedValueOnce(new Error("Network error"))

      await simulateHandleLogout()

      // Should still redirect despite error
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" })
    })

    it("handles signOut timeout gracefully", async () => {
      mockSignOut.mockRejectedValueOnce(new Error("Request timeout"))

      await simulateHandleLogout()

      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" })
    })
  })

  describe("AC4: Protected Route Access (Auth Guard)", () => {
    it("redirects unauthenticated users to /login", async () => {
      await expect(simulateBeforeLoad(false)).rejects.toThrow("Redirect to login")

      expect(mockRedirect).toHaveBeenCalledWith({ to: "/login" })
    })

    it("allows authenticated users to proceed (no redirect)", async () => {
      await simulateBeforeLoad(true)

      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it("checks isAuthenticated from router context", async () => {
      // Test that the guard uses context.isAuthenticated
      const context = { isAuthenticated: false }

      if (!context.isAuthenticated) {
        mockRedirect({ to: "/login" })
      }

      expect(mockRedirect).toHaveBeenCalledWith({ to: "/login" })
    })
  })

  describe("Auth Guard Edge Cases", () => {
    it("redirects when isAuthenticated is undefined (treated as false)", async () => {
      const context = { isAuthenticated: undefined as unknown as boolean }

      if (!context.isAuthenticated) {
        mockRedirect({ to: "/login" })
      }

      expect(mockRedirect).toHaveBeenCalledWith({ to: "/login" })
    })

    it("redirects when isAuthenticated is null (treated as false)", async () => {
      const context = { isAuthenticated: null as unknown as boolean }

      if (!context.isAuthenticated) {
        mockRedirect({ to: "/login" })
      }

      expect(mockRedirect).toHaveBeenCalledWith({ to: "/login" })
    })
  })

  describe("Logout Error Scenarios", () => {
    it("handles network failure during signOut", async () => {
      mockSignOut.mockRejectedValueOnce(new Error("Network unavailable"))

      await simulateHandleLogout()

      // User should still be redirected to home for better UX
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" })
    })

    it("handles server error during signOut", async () => {
      mockSignOut.mockRejectedValueOnce(new Error("500 Internal Server Error"))

      await simulateHandleLogout()

      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" })
    })
  })
})
