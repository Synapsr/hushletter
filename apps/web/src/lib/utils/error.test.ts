import { describe, it, expect } from "vitest"
import { getErrorMessage, extractNameFromEmail } from "./error"

describe("getErrorMessage", () => {
  it("returns string errors as-is", () => {
    expect(getErrorMessage("Something went wrong")).toBe("Something went wrong")
  })

  it("extracts message from Error objects", () => {
    expect(getErrorMessage(new Error("Test error"))).toBe("Test error")
  })

  it("extracts message from objects with message property", () => {
    expect(getErrorMessage({ message: "Object error" })).toBe("Object error")
  })

  it("handles nested error objects", () => {
    expect(
      getErrorMessage({ error: { message: "Nested error" } })
    ).toBe("Nested error")
  })

  it("returns default message for null", () => {
    expect(getErrorMessage(null)).toBe("An unexpected error occurred")
  })

  it("returns default message for undefined", () => {
    expect(getErrorMessage(undefined)).toBe("An unexpected error occurred")
  })

  it("returns default message for numbers", () => {
    expect(getErrorMessage(42)).toBe("An unexpected error occurred")
  })

  it("returns default message for empty objects", () => {
    expect(getErrorMessage({})).toBe("An unexpected error occurred")
  })
})

describe("extractNameFromEmail", () => {
  it("extracts username from standard email", () => {
    expect(extractNameFromEmail("john@example.com")).toBe("john")
  })

  it("handles email with dots in username", () => {
    expect(extractNameFromEmail("john.doe@example.com")).toBe("john.doe")
  })

  it("handles email with plus sign", () => {
    expect(extractNameFromEmail("john+test@example.com")).toBe("john+test")
  })

  it("handles multiple @ symbols by taking first part", () => {
    expect(extractNameFromEmail("john@weird@example.com")).toBe("john")
  })

  it("returns User for empty string", () => {
    expect(extractNameFromEmail("")).toBe("User")
  })

  it("returns User for email starting with @", () => {
    expect(extractNameFromEmail("@example.com")).toBe("User")
  })

  it("returns User for null/undefined input", () => {
    expect(extractNameFromEmail(null as any)).toBe("User")
    expect(extractNameFromEmail(undefined as any)).toBe("User")
  })

  it("trims whitespace from prefix", () => {
    expect(extractNameFromEmail("  john  @example.com")).toBe("john")
  })
})
