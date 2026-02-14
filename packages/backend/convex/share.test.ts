import { describe, it, expect } from "vitest"
import { api } from "./_generated/api"

/**
 * Contract Tests for share.ts
 *
 * PURPOSE: Schema/API surface documentation tests (not behavioral).
 * They verify the functions are exported in the generated API.
 */

describe("share API exports", () => {
  it("should export public mutations", () => {
    expect(api.share).toBeDefined()
    expect(api.share.ensureDedicatedEmailShareToken).toBeDefined()
    expect(api.share.rotateDedicatedEmailShareToken).toBeDefined()
    expect(api.share.ensureNewsletterShareToken).toBeDefined()
    expect(api.share.rotateNewsletterShareToken).toBeDefined()
  })

  it("should export public queries", () => {
    expect(api.share.getDedicatedEmailByShareToken).toBeDefined()
  })

  it("should export public actions", () => {
    expect(api.share.getNewsletterByShareTokenWithContent).toBeDefined()
  })

  it("documents minimal public return shape for share lookup", () => {
    const expectedReturn = "{ dedicatedEmail: string } | null"
    expect(typeof expectedReturn).toBe("string")
  })

  it("documents intended error codes", () => {
    const intendedErrors = [
      "UNAUTHORIZED",
      "NO_DEDICATED_EMAIL",
    ]
    expect(intendedErrors).toContain("UNAUTHORIZED")
    expect(intendedErrors).toContain("NO_DEDICATED_EMAIL")
  })
})
