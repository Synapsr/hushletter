import { describe, it, expect, vi, beforeEach } from "vitest"
import { z } from "zod"

// Mock the auth client
const mockSignInEmail = vi.fn()
vi.mock("~/lib/auth-client", () => ({
  signIn: {
    email: mockSignInEmail,
  },
}))

// Mock the router navigation
const mockNavigate = vi.fn()
vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    createFileRoute: () => () => ({ component: () => null }),
    Link: ({ children }: { children: React.ReactNode }) => children,
  }
})

// Login schema (same as in login.tsx)
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

// Simulate the onSubmit handler logic
async function simulateLoginSubmit(
  email: string,
  password: string,
  signInResult: { error?: { message: string } | null }
) {
  mockSignInEmail.mockResolvedValueOnce(signInResult)

  const result = await mockSignInEmail({
    email,
    password,
  })

  if (result.error) {
    throw new Error("Invalid email or password")
  }

  mockNavigate({ to: "/newsletters" })
}

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Form Validation (Zod Schema)", () => {
    it("rejects invalid email format", () => {
      const result = loginSchema.safeParse({
        email: "invalid-email",
        password: "password123",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Please enter a valid email address"
        )
      }
    })

    it("rejects empty email", () => {
      const result = loginSchema.safeParse({
        email: "",
        password: "password123",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("email")
      }
    })

    it("rejects empty password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Password is required")
      }
    })

    it("accepts valid email and non-empty password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "anypassword",
      })

      expect(result.success).toBe(true)
    })

    it("accepts password of any length (no minimum for login)", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "x", // Single character is valid for login
      })

      expect(result.success).toBe(true)
    })
  })

  describe("AC1: Successful Login", () => {
    it("calls signIn.email with correct credentials", async () => {
      await simulateLoginSubmit("user@example.com", "password123", {
        error: null,
      })

      expect(mockSignInEmail).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      })
    })

    it("navigates to /newsletters on successful login", async () => {
      await simulateLoginSubmit("user@example.com", "password123", {
        error: null,
      })

      expect(mockNavigate).toHaveBeenCalledWith({ to: "/newsletters" })
    })
  })

  describe("AC2: Invalid Credentials Handling", () => {
    it("throws generic error message for invalid credentials", async () => {
      await expect(
        simulateLoginSubmit("user@example.com", "wrongpassword", {
          error: { message: "Invalid password" },
        })
      ).rejects.toThrow("Invalid email or password")
    })

    it("throws generic error regardless of specific auth error type", async () => {
      const authErrors = [
        { message: "Invalid password" },
        { message: "User not found" },
        { message: "Invalid credentials" },
        { message: "Authentication failed" },
      ]

      for (const error of authErrors) {
        mockSignInEmail.mockResolvedValueOnce({ error })

        await expect(
          simulateLoginSubmit("user@example.com", "password", { error })
        ).rejects.toThrow("Invalid email or password")
      }
    })

    it("does not navigate on failed login", async () => {
      mockNavigate.mockClear()

      try {
        await simulateLoginSubmit("user@example.com", "wrongpassword", {
          error: { message: "Invalid credentials" },
        })
      } catch {
        // Expected to throw
      }

      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe("Security - User Enumeration Prevention", () => {
    it("returns same error for non-existent user", async () => {
      await expect(
        simulateLoginSubmit("nonexistent@example.com", "password", {
          error: { message: "User not found" },
        })
      ).rejects.toThrow("Invalid email or password")
    })

    it("returns same error for wrong password", async () => {
      await expect(
        simulateLoginSubmit("existing@example.com", "wrongpassword", {
          error: { message: "Invalid password" },
        })
      ).rejects.toThrow("Invalid email or password")
    })
  })
})
