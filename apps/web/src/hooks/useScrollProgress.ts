import { useEffect, useRef, useCallback } from "react"

interface UseScrollProgressOptions {
  /** Ref to the scrollable container element */
  containerRef: React.RefObject<HTMLElement | null>
  /** Callback fired when progress changes significantly */
  onProgress: (progress: number) => void
  /** Debounce delay in milliseconds (default: 2000) */
  debounceMs?: number
  /** Minimum progress change threshold to trigger callback (default: 5) */
  thresholdPercent?: number
}

interface UseScrollProgressReturn {
  /** Manually calculate current progress percentage */
  calculateProgress: () => number
}

/**
 * Track scroll progress as percentage within a container
 * Story 3.4: AC1 - Scroll position tracking
 *
 * Features:
 * - Debounced progress updates to prevent database spam
 * - Threshold-based reporting (only fires when progress changes significantly)
 * - Immediate callback at 100% for auto-mark-as-read
 * - Cleanup on unmount
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null)
 * useScrollProgress({
 *   containerRef,
 *   onProgress: (progress) => updateMutation({ readProgress: progress }),
 *   debounceMs: 2000,
 *   thresholdPercent: 5,
 * })
 * ```
 */
export function useScrollProgress({
  containerRef,
  onProgress,
  debounceMs = 2000,
  thresholdPercent = 5,
}: UseScrollProgressOptions): UseScrollProgressReturn {
  const lastReportedProgress = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const calculateProgress = useCallback(() => {
    const container = containerRef.current
    if (!container) return 0

    const { scrollTop, scrollHeight, clientHeight } = container
    const scrollableHeight = scrollHeight - clientHeight

    // Content fits without scrolling - consider it 100% read
    if (scrollableHeight <= 0) return 100

    const progress = Math.round((scrollTop / scrollableHeight) * 100)
    return Math.min(100, Math.max(0, progress))
  }, [containerRef])

  const reportProgress = useCallback(
    (progress: number) => {
      const diff = Math.abs(progress - lastReportedProgress.current)

      // Report if threshold exceeded OR reached 100%
      if (diff >= thresholdPercent || progress === 100) {
        lastReportedProgress.current = progress
        onProgress(progress)
      }
    },
    [onProgress, thresholdPercent]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const progress = calculateProgress()

      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Immediately report 100% (completion) without debounce
      if (progress === 100) {
        reportProgress(100)
        return
      }

      // Debounce other progress updates
      timeoutRef.current = setTimeout(() => {
        reportProgress(progress)
      }, debounceMs)
    }

    container.addEventListener("scroll", handleScroll)

    // Check initial state - if content fits without scrolling, report 100% immediately
    // This handles short newsletters that don't require scrolling
    const initialProgress = calculateProgress()
    if (initialProgress === 100) {
      reportProgress(100)
    }

    return () => {
      container.removeEventListener("scroll", handleScroll)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [containerRef, calculateProgress, reportProgress, debounceMs])

  return { calculateProgress }
}
