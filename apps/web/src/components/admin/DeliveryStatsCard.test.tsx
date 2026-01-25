import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { DeliveryStatsCard } from "./DeliveryStatsCard"

/**
 * Tests for DeliveryStatsCard component
 * Story 7.2: Task 4.2 - Success/failure rate display
 */

const mockStats = {
  received: 5,
  processing: 3,
  stored: 85,
  failed: 7,
  total: 100,
  successRate: 85,
  periodHours: 24,
}

describe("DeliveryStatsCard", () => {
  it("renders total received count", () => {
    render(<DeliveryStatsCard stats={mockStats} />)

    expect(screen.getByText("Total Received")).toBeInTheDocument()
    expect(screen.getByText("100")).toBeInTheDocument()
    expect(screen.getByText("emails in 24h")).toBeInTheDocument()
  })

  it("renders successfully stored count with success rate", () => {
    render(<DeliveryStatsCard stats={mockStats} />)

    expect(screen.getByText("Successfully Stored")).toBeInTheDocument()
    expect(screen.getByText("85")).toBeInTheDocument()
    expect(screen.getByText("85% success rate")).toBeInTheDocument()
  })

  it("renders processing count (received + processing)", () => {
    render(<DeliveryStatsCard stats={mockStats} />)

    expect(screen.getByText("Processing")).toBeInTheDocument()
    // received (5) + processing (3) = 8
    expect(screen.getByText("8")).toBeInTheDocument()
    expect(screen.getByText("in progress")).toBeInTheDocument()
  })

  it("renders failed count", () => {
    render(<DeliveryStatsCard stats={mockStats} />)

    expect(screen.getByText("Failed")).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
    expect(screen.getByText("need attention")).toBeInTheDocument()
  })

  it("renders four stat cards in grid", () => {
    render(<DeliveryStatsCard stats={mockStats} />)

    // Check for 4 card titles (one for each stat)
    expect(screen.getByText("Total Received")).toBeInTheDocument()
    expect(screen.getByText("Successfully Stored")).toBeInTheDocument()
    expect(screen.getByText("Processing")).toBeInTheDocument()
    expect(screen.getByText("Failed")).toBeInTheDocument()
  })

  it("displays correct aria labels for accessibility", () => {
    render(<DeliveryStatsCard stats={mockStats} />)

    expect(screen.getByLabelText("Total received: 100")).toBeInTheDocument()
    expect(screen.getByLabelText("Successfully stored: 85")).toBeInTheDocument()
    expect(screen.getByLabelText("Processing: 8")).toBeInTheDocument()
    expect(screen.getByLabelText("Failed: 7")).toBeInTheDocument()
  })

  it("formats large numbers with locale string", () => {
    const largeStats = {
      ...mockStats,
      total: 1234567,
      stored: 1234000,
    }

    render(<DeliveryStatsCard stats={largeStats} />)

    // Should show formatted number
    expect(screen.getByText("1,234,567")).toBeInTheDocument()
    expect(screen.getByText("1,234,000")).toBeInTheDocument()
  })

  it("handles zero values correctly", () => {
    const zeroStats = {
      received: 0,
      processing: 0,
      stored: 0,
      failed: 0,
      total: 0,
      successRate: 100,
      periodHours: 24,
    }

    render(<DeliveryStatsCard stats={zeroStats} />)

    // All values should be 0
    const zeros = screen.getAllByText("0")
    expect(zeros.length).toBeGreaterThanOrEqual(4)
  })
})
