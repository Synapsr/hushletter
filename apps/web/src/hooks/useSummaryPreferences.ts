import { useState, useCallback, useEffect } from "react"

/** Storage key for summary collapse preference */
const STORAGE_KEY = "hushletter:summary-collapsed"

interface UseSummaryPreferencesReturn {
  /** Whether the summary panel should be collapsed */
  isCollapsed: boolean
  /** Update the collapse preference (persists to localStorage) */
  setCollapsed: (collapsed: boolean) => void
  /** Toggle the collapse state */
  toggleCollapsed: () => void
}

/**
 * Hook for managing user's summary display preferences
 * Story 5.2: Task 2 - Summary collapse preference persistence
 *
 * Persists the collapse state to localStorage so users don't have to
 * re-expand/collapse the summary panel every time they view a newsletter.
 *
 * Note: Uses global preference (applies to all newsletters) for simplicity.
 * Per-newsletter preference would require additional storage complexity.
 *
 * Code review fix: Hydration-safe pattern - server and client both start with false,
 * then client updates after hydration to avoid SSR/CSR mismatch.
 *
 * @example
 * ```tsx
 * const { isCollapsed, toggleCollapsed } = useSummaryPreferences()
 *
 * return (
 *   <button onClick={toggleCollapsed}>
 *     {isCollapsed ? "Expand" : "Collapse"}
 *   </button>
 * )
 * ```
 */
export function useSummaryPreferences(): UseSummaryPreferencesReturn {
  // Start with false for both server and client to avoid hydration mismatch
  const [isCollapsed, setIsCollapsedState] = useState<boolean>(false)

  // Sync with localStorage after hydration
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true") {
        setIsCollapsedState(true)
      }
    } catch {
      // Ignore localStorage errors (private browsing, etc.)
    }
  }, [])

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed)

    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed))
    } catch {
      // Ignore localStorage errors (quota exceeded, private browsing)
      console.warn("[useSummaryPreferences] Failed to persist preference to localStorage")
    }
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!isCollapsed)
  }, [isCollapsed, setCollapsed])

  return { isCollapsed, setCollapsed, toggleCollapsed }
}
