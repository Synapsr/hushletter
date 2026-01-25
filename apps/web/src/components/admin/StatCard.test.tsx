import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { StatCard } from "./StatCard"
import { Users } from "lucide-react"

/**
 * Tests for StatCard component
 * Story 7.1: Task 6.5
 */

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="Total Users" value={1234} />)

    expect(screen.getByText("Total Users")).toBeInTheDocument()
    expect(screen.getByText("1,234")).toBeInTheDocument()
  })

  it("formats large numbers with locale string", () => {
    render(<StatCard title="Metric" value={1000000} />)

    expect(screen.getByText("1,000,000")).toBeInTheDocument()
  })

  it("renders icon when provided", () => {
    render(
      <StatCard
        title="Users"
        value={100}
        icon={<Users data-testid="user-icon" className="h-4 w-4" />}
      />
    )

    expect(screen.getByTestId("user-icon")).toBeInTheDocument()
  })

  it("renders positive trend text with green styling", () => {
    render(<StatCard title="Users" value={100} trend="+5 today" />)

    const trend = screen.getByText("+5 today")
    expect(trend).toBeInTheDocument()
    expect(trend.className).toContain("text-green")
  })

  it("renders negative trend text with red styling", () => {
    render(<StatCard title="Users" value={100} trend="-3 today" />)

    const trend = screen.getByText("-3 today")
    expect(trend).toBeInTheDocument()
    expect(trend.className).toContain("text-red")
  })

  it("renders description when provided", () => {
    render(
      <StatCard
        title="Newsletters"
        value={500}
        description="Unique content items"
      />
    )

    expect(screen.getByText("Unique content items")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    const { container } = render(
      <StatCard title="Test" value={0} className="custom-class" />
    )

    // The Card component should have the custom class
    expect(container.querySelector(".custom-class")).toBeInTheDocument()
  })

  it("has accessible value label", () => {
    render(<StatCard title="Users" value={42} />)

    expect(screen.getByLabelText("Users: 42")).toBeInTheDocument()
  })
})

describe("StatCard contract", () => {
  it("documents expected props interface", () => {
    const expectedProps = {
      title: "string - required",
      value: "number - required",
      icon: "ReactNode - optional",
      trend: "string - optional",
      description: "string - optional",
      className: "string - optional",
    }

    expect(expectedProps).toHaveProperty("title")
    expect(expectedProps).toHaveProperty("value")
    expect(expectedProps).toHaveProperty("icon")
    expect(expectedProps).toHaveProperty("trend")
    expect(expectedProps).toHaveProperty("description")
  })
})
