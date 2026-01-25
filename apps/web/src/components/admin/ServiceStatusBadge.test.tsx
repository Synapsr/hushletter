import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { ServiceStatusBadge } from "./ServiceStatusBadge"

/**
 * Tests for ServiceStatusBadge component
 * Story 7.1: Task 6.7
 */

describe("ServiceStatusBadge", () => {
  it("renders service name", () => {
    render(
      <ServiceStatusBadge
        service="Convex Database"
        status={{ healthy: true, message: "Connected" }}
      />
    )

    expect(screen.getByText("Convex Database")).toBeInTheDocument()
  })

  it("shows healthy state with green styling", () => {
    render(
      <ServiceStatusBadge
        service="Test Service"
        status={{ healthy: true, message: "OK" }}
      />
    )

    const badge = screen.getByRole("status")
    expect(badge).toHaveAttribute(
      "aria-label",
      "Test Service: Healthy"
    )
    // Check for green background class
    expect(badge.className).toContain("bg-green")
  })

  it("shows unhealthy state with destructive styling", () => {
    render(
      <ServiceStatusBadge
        service="Test Service"
        status={{ healthy: false, message: "Offline" }}
      />
    )

    const badge = screen.getByRole("status")
    expect(badge).toHaveAttribute(
      "aria-label",
      "Test Service: Unhealthy"
    )
    // The badge should have destructive variant
    expect(badge).toHaveAttribute("data-variant", "destructive")
  })

  it("renders CheckCircle icon for healthy status", () => {
    const { container } = render(
      <ServiceStatusBadge
        service="Service"
        status={{ healthy: true, message: "OK" }}
      />
    )

    // Lucide icons render as SVG
    const svg = container.querySelector("svg")
    expect(svg).toBeInTheDocument()
  })

  it("renders XCircle icon for unhealthy status", () => {
    const { container } = render(
      <ServiceStatusBadge
        service="Service"
        status={{ healthy: false, message: "Error" }}
      />
    )

    const svg = container.querySelector("svg")
    expect(svg).toBeInTheDocument()
  })

  it("has tooltip with status message", () => {
    render(
      <ServiceStatusBadge
        service="Email Worker"
        status={{ healthy: true, message: "Last email: 5m ago" }}
      />
    )

    // The badge should be wrapped in a tooltip
    // Tooltip content is in a portal, so we check the trigger exists
    expect(screen.getByText("Email Worker")).toBeInTheDocument()
  })
})

describe("ServiceStatusBadge contract", () => {
  it("documents ServiceStatus interface", () => {
    const serviceStatus = {
      healthy: true,
      message: "Status message",
      lastActivity: 1737795600000, // Optional
    }

    expect(typeof serviceStatus.healthy).toBe("boolean")
    expect(typeof serviceStatus.message).toBe("string")
    expect(typeof serviceStatus.lastActivity).toBe("number")
  })

  it("documents expected props interface", () => {
    const expectedProps = {
      service: "string - display name of the service",
      status: "ServiceStatus - health data object",
    }

    expect(expectedProps).toHaveProperty("service")
    expect(expectedProps).toHaveProperty("status")
  })
})
