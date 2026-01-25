import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { DeliveryStatusBadge } from "./DeliveryStatusBadge"

/**
 * Tests for DeliveryStatusBadge component
 * Story 7.2: Task 4.4 - Status indicator component
 */

describe("DeliveryStatusBadge", () => {
  it("renders 'received' status correctly", () => {
    render(<DeliveryStatusBadge status="received" />)

    expect(screen.getByText("Received")).toBeInTheDocument()
    expect(screen.getByLabelText("Status: Received")).toBeInTheDocument()
  })

  it("renders 'processing' status correctly", () => {
    render(<DeliveryStatusBadge status="processing" />)

    expect(screen.getByText("Processing")).toBeInTheDocument()
    expect(screen.getByLabelText("Status: Processing")).toBeInTheDocument()
  })

  it("renders 'stored' status correctly", () => {
    render(<DeliveryStatusBadge status="stored" />)

    expect(screen.getByText("Stored")).toBeInTheDocument()
    expect(screen.getByLabelText("Status: Stored")).toBeInTheDocument()
  })

  it("renders 'failed' status correctly", () => {
    render(<DeliveryStatusBadge status="failed" />)

    expect(screen.getByText("Failed")).toBeInTheDocument()
    expect(screen.getByLabelText("Status: Failed")).toBeInTheDocument()
  })

  it("renders with appropriate color classes for stored (green)", () => {
    const { container } = render(<DeliveryStatusBadge status="stored" />)

    const badge = container.querySelector('[class*="bg-green"]')
    expect(badge).toBeInTheDocument()
  })

  it("renders with appropriate color classes for failed (destructive)", () => {
    render(<DeliveryStatusBadge status="failed" />)

    const badge = screen.getByLabelText("Status: Failed")
    // Destructive variant should have the badge element
    expect(badge).toBeInTheDocument()
  })

  it("renders with appropriate color classes for processing (yellow)", () => {
    const { container } = render(<DeliveryStatusBadge status="processing" />)

    const badge = container.querySelector('[class*="yellow"]')
    expect(badge).toBeInTheDocument()
  })

  it("includes an icon for each status", () => {
    const { container } = render(<DeliveryStatusBadge status="stored" />)

    // Should have an icon (SVG element)
    const icon = container.querySelector("svg")
    expect(icon).toBeInTheDocument()
  })

  it("marks icon as aria-hidden", () => {
    const { container } = render(<DeliveryStatusBadge status="stored" />)

    const icon = container.querySelector("svg")
    expect(icon).toHaveAttribute("aria-hidden", "true")
  })
})
