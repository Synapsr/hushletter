import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { AnomalyAlertBanner } from "./AnomalyAlertBanner"

/**
 * Tests for AnomalyAlertBanner component
 * Story 7.2: Task 6.3 - Warning banner for dashboard
 */

describe("AnomalyAlertBanner", () => {
  it("renders nothing when anomalies array is empty", () => {
    const { container } = render(<AnomalyAlertBanner anomalies={[]} />)

    // The region should exist but be empty of alerts
    const alerts = container.querySelectorAll('[role="alert"]')
    expect(alerts.length).toBe(0)
  })

  it("renders critical alerts with destructive style", () => {
    const anomalies = [
      {
        type: "high_failure_rate" as const,
        severity: "critical" as const,
        message: "50% of emails failed in last 24h",
        details: { failed: 50, total: 100 },
      },
    ]

    render(<AnomalyAlertBanner anomalies={anomalies} />)

    expect(screen.getByText("Critical Alert")).toBeInTheDocument()
    expect(screen.getByText("50% of emails failed in last 24h")).toBeInTheDocument()
  })

  it("renders warning alerts with yellow style", () => {
    const anomalies = [
      {
        type: "no_deliveries" as const,
        severity: "warning" as const,
        message: "No email deliveries in the last 24 hours",
        details: {},
      },
    ]

    const { container } = render(<AnomalyAlertBanner anomalies={anomalies} />)

    expect(screen.getByText("Warning")).toBeInTheDocument()
    expect(screen.getByText("No email deliveries in the last 24 hours")).toBeInTheDocument()

    // Check for yellow styling
    const alert = container.querySelector('[class*="yellow"]')
    expect(alert).toBeInTheDocument()
  })

  it("renders critical alerts before warning alerts", () => {
    const anomalies = [
      {
        type: "no_deliveries" as const,
        severity: "warning" as const,
        message: "Warning message",
        details: {},
      },
      {
        type: "high_failure_rate" as const,
        severity: "critical" as const,
        message: "Critical message",
        details: {},
      },
    ]

    render(<AnomalyAlertBanner anomalies={anomalies} />)

    // Verify critical message appears before warning message in DOM
    // Critical comes first, then Warning
    const criticalText = screen.getByText("Critical message")
    const warningText = screen.getByText("Warning message")

    // Check that critical element appears before warning in document
    expect(criticalText.compareDocumentPosition(warningText)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("renders multiple critical alerts", () => {
    const anomalies = [
      {
        type: "high_failure_rate" as const,
        severity: "critical" as const,
        message: "Critical 1",
        details: {},
      },
      {
        type: "high_failure_rate" as const,
        severity: "critical" as const,
        message: "Critical 2",
        details: {},
      },
    ]

    render(<AnomalyAlertBanner anomalies={anomalies} />)

    expect(screen.getByText("Critical 1")).toBeInTheDocument()
    expect(screen.getByText("Critical 2")).toBeInTheDocument()
    expect(screen.getAllByText("Critical Alert")).toHaveLength(2)
  })

  it("renders multiple warning alerts", () => {
    const anomalies = [
      {
        type: "no_deliveries" as const,
        severity: "warning" as const,
        message: "Warning 1",
        details: {},
      },
      {
        type: "volume_spike" as const,
        severity: "warning" as const,
        message: "Warning 2",
        details: {},
      },
    ]

    render(<AnomalyAlertBanner anomalies={anomalies} />)

    expect(screen.getByText("Warning 1")).toBeInTheDocument()
    expect(screen.getByText("Warning 2")).toBeInTheDocument()
    expect(screen.getAllByText("Warning")).toHaveLength(2)
  })

  it("renders mixed critical and warning alerts", () => {
    const anomalies = [
      {
        type: "high_failure_rate" as const,
        severity: "critical" as const,
        message: "Critical issue",
        details: {},
      },
      {
        type: "no_deliveries" as const,
        severity: "warning" as const,
        message: "Warning issue",
        details: {},
      },
      {
        type: "volume_spike" as const,
        severity: "warning" as const,
        message: "Another warning",
        details: {},
      },
    ]

    render(<AnomalyAlertBanner anomalies={anomalies} />)

    expect(screen.getByText("Critical issue")).toBeInTheDocument()
    expect(screen.getByText("Warning issue")).toBeInTheDocument()
    expect(screen.getByText("Another warning")).toBeInTheDocument()
  })

  it("has proper accessibility region", () => {
    const anomalies = [
      {
        type: "no_deliveries" as const,
        severity: "warning" as const,
        message: "Test message",
        details: {},
      },
    ]

    render(<AnomalyAlertBanner anomalies={anomalies} />)

    expect(screen.getByRole("region", { name: "System alerts" })).toBeInTheDocument()
  })

  it("hides icons from screen readers", () => {
    const anomalies = [
      {
        type: "no_deliveries" as const,
        severity: "warning" as const,
        message: "Test message",
        details: {},
      },
    ]

    const { container } = render(<AnomalyAlertBanner anomalies={anomalies} />)

    const icons = container.querySelectorAll("svg")
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute("aria-hidden", "true")
    })
  })

  it("renders all anomaly types correctly", () => {
    const anomalies = [
      {
        type: "high_failure_rate" as const,
        severity: "warning" as const,
        message: "High failure rate message",
        details: {},
      },
      {
        type: "no_deliveries" as const,
        severity: "warning" as const,
        message: "No deliveries message",
        details: {},
      },
      {
        type: "volume_spike" as const,
        severity: "warning" as const,
        message: "Volume spike message",
        details: {},
      },
    ]

    render(<AnomalyAlertBanner anomalies={anomalies} />)

    expect(screen.getByText("High failure rate message")).toBeInTheDocument()
    expect(screen.getByText("No deliveries message")).toBeInTheDocument()
    expect(screen.getByText("Volume spike message")).toBeInTheDocument()
  })
})
