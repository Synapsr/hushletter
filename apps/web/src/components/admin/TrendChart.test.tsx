import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { TrendChart } from "./TrendChart"

/**
 * Tests for TrendChart component
 * Story 7.1: Task 6.6
 */

// Helper to create metrics history items
function createMetricsItem(overrides: Partial<{
  date: string
  totalUsers: number
  totalNewsletters: number
  totalSenders: number
  totalUserNewsletters: number
}>) {
  return {
    date: "2026-01-01",
    totalUsers: 100,
    totalNewsletters: 500,
    totalSenders: 50,
    totalUserNewsletters: 1000,
    ...overrides,
  }
}

describe("TrendChart", () => {
  it("shows message when not enough data points", () => {
    // Only 1 data point - not enough for trend analysis
    const data = [createMetricsItem({ date: "2026-01-25" })]

    render(<TrendChart data={data} />)

    expect(
      screen.getByText(/not enough data for trend analysis/i)
    ).toBeInTheDocument()
  })

  it("shows message when empty data", () => {
    render(<TrendChart data={[]} />)

    expect(
      screen.getByText(/not enough data for trend analysis/i)
    ).toBeInTheDocument()
  })

  it("calculates growth between first and last data points", () => {
    const data = [
      createMetricsItem({
        date: "2026-01-01",
        totalUsers: 100,
        totalNewsletters: 500,
        totalSenders: 50,
      }),
      createMetricsItem({
        date: "2026-01-25",
        totalUsers: 150,
        totalNewsletters: 750,
        totalSenders: 60,
      }),
    ]

    render(<TrendChart data={data} />)

    // Should show +50 users, +250 newsletters, +10 senders
    expect(screen.getByText("+50")).toBeInTheDocument()
    expect(screen.getByText("+250")).toBeInTheDocument()
    expect(screen.getByText("+10")).toBeInTheDocument()
  })

  it("shows negative growth with minus sign", () => {
    const data = [
      createMetricsItem({
        date: "2026-01-01",
        totalUsers: 150,
      }),
      createMetricsItem({
        date: "2026-01-25",
        totalUsers: 100,
      }),
    ]

    render(<TrendChart data={data} />)

    // Should show -50 users
    expect(screen.getByText("-50")).toBeInTheDocument()
  })

  it("shows date range in footer", () => {
    const data = [
      createMetricsItem({ date: "2026-01-01" }),
      createMetricsItem({ date: "2026-01-25" }),
    ]

    render(<TrendChart data={data} />)

    expect(screen.getByText(/2026-01-01/)).toBeInTheDocument()
    expect(screen.getByText(/2026-01-25/)).toBeInTheDocument()
  })

  it("shows data point count", () => {
    const data = [
      createMetricsItem({ date: "2026-01-01" }),
      createMetricsItem({ date: "2026-01-15" }),
      createMetricsItem({ date: "2026-01-25" }),
    ]

    render(<TrendChart data={data} />)

    expect(screen.getByText(/Data points: 3/)).toBeInTheDocument()
  })

  it("renders growth labels for all metrics", () => {
    const data = [
      createMetricsItem({ date: "2026-01-01" }),
      createMetricsItem({ date: "2026-01-25" }),
    ]

    render(<TrendChart data={data} />)

    expect(screen.getByText("Users")).toBeInTheDocument()
    expect(screen.getByText("Newsletters")).toBeInTheDocument()
    expect(screen.getByText("Senders")).toBeInTheDocument()
  })

  it("has accessible region", () => {
    const data = [
      createMetricsItem({ date: "2026-01-01" }),
      createMetricsItem({ date: "2026-01-25" }),
    ]

    render(<TrendChart data={data} />)

    expect(screen.getByRole("region")).toHaveAttribute(
      "aria-label",
      "Trend analysis"
    )
  })
})

describe("TrendChart contract", () => {
  it("documents MetricsHistoryItem interface", () => {
    const metricsItem = {
      date: "2026-01-25",
      totalUsers: 100,
      totalNewsletters: 500,
      totalSenders: 50,
      totalUserNewsletters: 1000,
    }

    expect(typeof metricsItem.date).toBe("string")
    expect(typeof metricsItem.totalUsers).toBe("number")
    expect(typeof metricsItem.totalNewsletters).toBe("number")
    expect(typeof metricsItem.totalSenders).toBe("number")
    expect(typeof metricsItem.totalUserNewsletters).toBe("number")
  })

  it("documents expected props interface", () => {
    const expectedProps = {
      data: "MetricsHistoryItem[] - array of historical data points",
    }

    expect(expectedProps).toHaveProperty("data")
  })

  it("documents minimum data requirements", () => {
    const requirements = {
      minimumDataPoints: 2,
      reason: "Need at least 2 points to calculate growth",
    }

    expect(requirements.minimumDataPoints).toBe(2)
  })
})
