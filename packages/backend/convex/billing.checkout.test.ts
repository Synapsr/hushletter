import { describe, expect, it } from "vitest"
import { buildSubscriptionCheckoutSessionParams } from "./billing"

describe("buildSubscriptionCheckoutSessionParams", () => {
  it("enables Stripe tax handling and required billing details", () => {
    const params = buildSubscriptionCheckoutSessionParams({
      customerId: "cus_123",
      priceId: "price_123",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    })

    expect(params.mode).toBe("subscription")
    expect(params.customer).toBe("cus_123")
    expect(params.allow_promotion_codes).toBe(true)

    expect(params.automatic_tax).toEqual({ enabled: true })
    expect(params.billing_address_collection).toBe("required")
    expect(params.tax_id_collection).toEqual({ enabled: true })
    expect(params.customer_update).toEqual({
      address: "auto",
      name: "auto",
    })

    expect(params.success_url).toBe("https://example.com/success")
    expect(params.cancel_url).toBe("https://example.com/cancel")
    expect(params.line_items).toEqual([{ price: "price_123", quantity: 1 }])
  })

  it("preserves subscription metadata when provided", () => {
    const params = buildSubscriptionCheckoutSessionParams({
      customerId: "cus_123",
      priceId: "price_123",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
      subscriptionMetadata: { userId: "user_123" },
    })

    expect(params.subscription_data).toEqual({
      metadata: { userId: "user_123" },
    })
  })
})
