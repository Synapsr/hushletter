export function estimateSize(data: unknown): number {
  if (data === undefined || data === null) return 0
  try {
    return JSON.stringify(data).length
  } catch {
    return 0
  }
}
