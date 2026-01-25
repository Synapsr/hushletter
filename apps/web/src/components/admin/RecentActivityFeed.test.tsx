import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { RecentActivityFeed } from "./RecentActivityFeed"

/**
 * Tests for RecentActivityFeed component
 * Story 7.1: Task 6 - Activity feed tests
 */

describe("RecentActivityFeed", () => {
  // Mock Date.now() for consistent time-based tests
  const mockNow = new Date("2026-01-25T12:00:00Z").getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(mockNow)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows empty state when no items", () => {
    render(<RecentActivityFeed items={[]} />)

    expect(screen.getByText("No recent activity")).toBeInTheDocument()
  })

  it("renders activity items", () => {
    const items = [
      {
        type: "newsletter" as const,
        subject: "Weekly Update",
        senderEmail: "news@example.com",
        timestamp: mockNow - 5 * 60 * 1000, // 5 minutes ago
      },
    ]

    render(<RecentActivityFeed items={items} />)

    expect(screen.getByText("Weekly Update")).toBeInTheDocument()
    expect(screen.getByText("from news@example.com")).toBeInTheDocument()
  })

  it("shows relative time for each item", () => {
    const items = [
      {
        type: "newsletter" as const,
        subject: "Test",
        senderEmail: "test@example.com",
        timestamp: mockNow - 60 * 60 * 1000, // 1 hour ago
      },
    ]

    render(<RecentActivityFeed items={items} />)

    // date-fns formatDistanceToNow should show "about 1 hour ago" or similar
    expect(screen.getByText(/hour/i)).toBeInTheDocument()
  })

  it("renders multiple items in a list", () => {
    const items = [
      {
        type: "newsletter" as const,
        subject: "First",
        senderEmail: "a@example.com",
        timestamp: mockNow - 1000,
      },
      {
        type: "newsletter" as const,
        subject: "Second",
        senderEmail: "b@example.com",
        timestamp: mockNow - 2000,
      },
      {
        type: "newsletter" as const,
        subject: "Third",
        senderEmail: "c@example.com",
        timestamp: mockNow - 3000,
      },
    ]

    render(<RecentActivityFeed items={items} />)

    expect(screen.getByText("First")).toBeInTheDocument()
    expect(screen.getByText("Second")).toBeInTheDocument()
    expect(screen.getByText("Third")).toBeInTheDocument()
  })

  it("has accessible list structure", () => {
    const items = [
      {
        type: "newsletter" as const,
        subject: "Test",
        senderEmail: "test@example.com",
        timestamp: mockNow,
      },
    ]

    render(<RecentActivityFeed items={items} />)

    expect(screen.getByRole("list")).toBeInTheDocument()
    expect(screen.getByRole("listitem")).toBeInTheDocument()
  })

  it("has accessible time elements", () => {
    const timestamp = mockNow - 60000
    const items = [
      {
        type: "newsletter" as const,
        subject: "Test",
        senderEmail: "test@example.com",
        timestamp,
      },
    ]

    render(<RecentActivityFeed items={items} />)

    const timeElement = screen.getByRole("listitem").querySelector("time")
    expect(timeElement).toHaveAttribute("dateTime")
    expect(timeElement).toHaveAttribute("aria-label")
  })
})

describe("RecentActivityFeed contract", () => {
  it("documents ActivityItem interface", () => {
    const activityItem = {
      type: "newsletter" as const,
      subject: "Subject line",
      senderEmail: "sender@example.com",
      timestamp: Date.now(),
    }

    expect(activityItem.type).toBe("newsletter")
    expect(typeof activityItem.subject).toBe("string")
    expect(typeof activityItem.senderEmail).toBe("string")
    expect(typeof activityItem.timestamp).toBe("number")
  })

  it("documents expected props interface", () => {
    const expectedProps = {
      items: "ActivityItem[] - list of recent activities",
    }

    expect(expectedProps).toHaveProperty("items")
  })
})
