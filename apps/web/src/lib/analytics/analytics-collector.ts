import type { QueryClient } from "@tanstack/react-query"
import type { ConvexQueryClient } from "@convex-dev/react-query"
import { getFunctionName } from "convex/server"
import type { AnalyticsEvent } from "./analytics-types"
import { estimateSize } from "./analytics-size"

const BATCH_SIZE = 50
const FLUSH_INTERVAL_MS = 30_000

let buffer: AnalyticsEvent[] = []

async function flush() {
  if (buffer.length === 0) return
  const batch = buffer.splice(0)
  try {
    const { writeAnalyticsBatch } = await import("./analytics-server")
    await writeAnalyticsBatch({ data: batch })
  } catch {
    // Silently drop on failure
  }
}

function track(event: AnalyticsEvent) {
  buffer.push(event)
  if (buffer.length >= BATCH_SIZE) {
    flush()
  }
}

function extractFunctionName(funcRef: unknown): string | null {
  try {
    return getFunctionName(funcRef as any)
  } catch {
    return null
  }
}

function subscribeToQueryCache(queryClient: QueryClient) {
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return
    if ((event as any).action?.type !== "success") return

    const queryKey = event.query.queryKey
    if (!Array.isArray(queryKey) || queryKey.length < 2) return

    const prefix = queryKey[0] as string
    if (prefix !== "convexQuery" && prefix !== "convexAction") return

    const functionName = extractFunctionName(queryKey[1])
    if (!functionName) return

    const functionType = prefix === "convexQuery" ? "query" : "action"
    const data = event.query.state.data

    // Distinguish initial load vs reactive update:
    // ConvexQueryClient sets data via setQueryData with a specific internal path.
    // After the first successful fetch, subsequent updates from subscriptions
    // go through setQueryData, which fires "updated" events with dataUpdateCount > 1.
    const isReactive = event.query.state.dataUpdateCount > 1

    track({
      timestamp: Date.now(),
      functionName,
      functionType,
      eventType: isReactive ? "reactive_update" : "initial",
      estimatedSizeBytes: estimateSize(data),
    })
  })
}

function patchConvexClient(convexQueryClient: ConvexQueryClient) {
  const client = convexQueryClient.convexClient as any

  // Patch mutation
  const originalMutation = client.mutation.bind(client)
  client.mutation = async (funcRef: any, args: any) => {
    const start = performance.now()
    const functionName = extractFunctionName(funcRef)
    try {
      const result = await originalMutation(funcRef, args)
      if (functionName) {
        track({
          timestamp: Date.now(),
          functionName,
          functionType: "mutation",
          eventType: "call",
          estimatedSizeBytes: estimateSize(result),
          durationMs: Math.round(performance.now() - start),
        })
      }
      return result
    } catch (e) {
      if (functionName) {
        track({
          timestamp: Date.now(),
          functionName,
          functionType: "mutation",
          eventType: "call",
          estimatedSizeBytes: 0,
          durationMs: Math.round(performance.now() - start),
        })
      }
      throw e
    }
  }

  // Patch action
  const originalAction = client.action.bind(client)
  client.action = async (funcRef: any, args: any) => {
    const start = performance.now()
    const functionName = extractFunctionName(funcRef)
    try {
      const result = await originalAction(funcRef, args)
      if (functionName) {
        track({
          timestamp: Date.now(),
          functionName,
          functionType: "action",
          eventType: "call",
          estimatedSizeBytes: estimateSize(result),
          durationMs: Math.round(performance.now() - start),
        })
      }
      return result
    } catch (e) {
      if (functionName) {
        track({
          timestamp: Date.now(),
          functionName,
          functionType: "action",
          eventType: "call",
          estimatedSizeBytes: 0,
          durationMs: Math.round(performance.now() - start),
        })
      }
      throw e
    }
  }
}

export function startAnalytics(
  queryClient: QueryClient,
  convexQueryClient: ConvexQueryClient,
) {
  subscribeToQueryCache(queryClient)
  patchConvexClient(convexQueryClient)

  setInterval(flush, FLUSH_INTERVAL_MS)

  // Flush on page unload
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush()
    }
  })
}
