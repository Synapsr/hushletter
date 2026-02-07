/**
 * PrivacyToggle Component Tests
 * Story 6.2: Task 7.2, 7.3
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PrivacyToggle } from "./PrivacyToggle"

// Mock the mutateAsync function
const mockMutateAsync = vi.fn()

// Mock the Convex mutation hook - returns the mutation function
vi.mock("@convex-dev/react-query", () => ({
  useConvexMutation: () => mockMutateAsync,
}))

// Mock TanStack Query hooks
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
  useMutation: ({ mutationFn }: { mutationFn: unknown }) => ({
    mutateAsync: mutationFn,
    isPending: false,
  }),
}))

// Mock the backend API
vi.mock("@hushletter/backend", () => ({
  api: {
    senders: {
      updateSenderSettings: "senders:updateSenderSettings",
    },
  },
}))

describe("PrivacyToggle", () => {
  const mockSenderId = "test-sender-id" as unknown as import("@hushletter/backend/convex/_generated/dataModel").Id<"senders">

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Task 7.2: Test privacy toggle renders correctly
  it("renders correctly when isPrivate is true", () => {
    render(<PrivacyToggle senderId={mockSenderId} isPrivate={true} />)

    // Should show Lock icon and "Private" label
    expect(screen.getByText("Private")).toBeInTheDocument()
    expect(screen.getByRole("switch")).toBeChecked()
  })

  it("renders correctly when isPrivate is false", () => {
    render(<PrivacyToggle senderId={mockSenderId} isPrivate={false} />)

    // Should show Unlock icon and "Public" label
    expect(screen.getByText("Public")).toBeInTheDocument()
    expect(screen.getByRole("switch")).not.toBeChecked()
  })

  it("renders compact version without label when compact prop is true", () => {
    render(<PrivacyToggle senderId={mockSenderId} isPrivate={true} compact />)

    // Should not show label text in compact mode
    expect(screen.queryByText("Private")).not.toBeInTheDocument()
    expect(screen.queryByText("Public")).not.toBeInTheDocument()
    // Switch should still be present
    expect(screen.getByRole("switch")).toBeInTheDocument()
  })

  // Task 7.2: Test privacy toggle calls updateSenderSettings mutation
  it("calls updateSenderSettings with correct args when toggled to private", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue(undefined)

    render(<PrivacyToggle senderId={mockSenderId} isPrivate={false} />)

    const toggle = screen.getByRole("switch")
    await user.click(toggle)

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        senderId: mockSenderId,
        isPrivate: true,
      })
    })
  })

  it("calls updateSenderSettings with correct args when toggled to public", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue(undefined)

    render(<PrivacyToggle senderId={mockSenderId} isPrivate={true} />)

    const toggle = screen.getByRole("switch")
    await user.click(toggle)

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        senderId: mockSenderId,
        isPrivate: false,
      })
    })
  })

  // Task 7.3: Test toggle handles errors gracefully
  it("handles mutation error gracefully and shows error indicator", async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockMutateAsync.mockRejectedValue(new Error("Update failed"))

    render(<PrivacyToggle senderId={mockSenderId} isPrivate={false} />)

    const toggle = screen.getByRole("switch")
    await user.click(toggle)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "[PrivacyToggle] Failed to update privacy setting:",
        expect.any(Error)
      )
    })

    // Code review fix (MEDIUM-2): Should show error indicator
    await waitFor(() => {
      expect(screen.getByLabelText("Error updating privacy")).toBeInTheDocument()
    })

    consoleSpy.mockRestore()
  })

  it("has correct aria-label for accessibility", () => {
    const { rerender } = render(<PrivacyToggle senderId={mockSenderId} isPrivate={false} />)

    expect(screen.getByRole("switch")).toHaveAttribute(
      "aria-label",
      "Mark sender as private"
    )

    rerender(<PrivacyToggle senderId={mockSenderId} isPrivate={true} />)

    expect(screen.getByRole("switch")).toHaveAttribute(
      "aria-label",
      "Mark sender as public"
    )
  })
})
