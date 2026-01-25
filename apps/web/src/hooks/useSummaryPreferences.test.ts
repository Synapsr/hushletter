import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSummaryPreferences } from "./useSummaryPreferences"

/**
 * Tests for useSummaryPreferences hook
 * Story 5.2: Task 6.6, 6.7, 6.8 - Preference persistence tests
 */

describe("useSummaryPreferences", () => {
  // Store the original localStorage
  const originalLocalStorage = window.localStorage

  // Mock localStorage with fresh store for each test
  const createLocalStorageMock = () => {
    let store: Record<string, string> = {}
    return {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      }),
      clear: vi.fn(() => {
        store = {}
      }),
      get length() {
        return Object.keys(store).length
      },
      key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    }
  }

  let localStorageMock: ReturnType<typeof createLocalStorageMock>

  beforeEach(() => {
    localStorageMock = createLocalStorageMock()
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    })
  })

  it("initializes with isCollapsed: false when no stored preference", () => {
    const { result } = renderHook(() => useSummaryPreferences())
    expect(result.current.isCollapsed).toBe(false)
  })

  it("initializes with isCollapsed: false then syncs to true from localStorage", async () => {
    // Set up localStorage to return "true"
    localStorageMock.getItem.mockReturnValue("true")

    const { result } = renderHook(() => useSummaryPreferences())

    // Initially false (hydration-safe), then syncs after useEffect
    await act(async () => {
      // Wait for useEffect to run
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.isCollapsed).toBe(true)
  })

  it("Task 6.6: persists collapse preference to localStorage", () => {
    const { result } = renderHook(() => useSummaryPreferences())

    act(() => {
      result.current.setCollapsed(true)
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "newsletter-manager:summary-collapsed",
      "true"
    )
    expect(result.current.isCollapsed).toBe(true)
  })

  it("Task 6.7: reads from localStorage on mount", () => {
    localStorageMock.getItem.mockReturnValue("true")

    renderHook(() => useSummaryPreferences())

    expect(localStorageMock.getItem).toHaveBeenCalledWith(
      "newsletter-manager:summary-collapsed"
    )
  })

  it("toggleCollapsed toggles the state", () => {
    const { result } = renderHook(() => useSummaryPreferences())

    expect(result.current.isCollapsed).toBe(false)

    act(() => {
      result.current.toggleCollapsed()
    })

    expect(result.current.isCollapsed).toBe(true)

    act(() => {
      result.current.toggleCollapsed()
    })

    expect(result.current.isCollapsed).toBe(false)
  })

  it("setCollapsed(false) persists 'false' to localStorage", () => {
    localStorageMock.getItem.mockReturnValue("true")
    const { result } = renderHook(() => useSummaryPreferences())

    act(() => {
      result.current.setCollapsed(false)
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "newsletter-manager:summary-collapsed",
      "false"
    )
  })

  it("handles localStorage errors gracefully", () => {
    // Simulate localStorage throwing an error (e.g., quota exceeded)
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { result } = renderHook(() => useSummaryPreferences())

    // Should not throw, just log warning
    act(() => {
      result.current.setCollapsed(true)
    })

    expect(consoleWarnSpy).toHaveBeenCalled()
    consoleWarnSpy.mockRestore()
  })

  it("uses namespaced storage key to avoid collisions", () => {
    const { result } = renderHook(() => useSummaryPreferences())

    act(() => {
      result.current.setCollapsed(true)
    })

    // Key should follow project's namespacing pattern
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      expect.stringMatching(/^newsletter-manager:/),
      expect.any(String)
    )
  })
})
