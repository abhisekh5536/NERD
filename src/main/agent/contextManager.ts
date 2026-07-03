const MAX_CONTENT_CHARS = 2_000_000
const SUMMARY_THRESHOLD_CHARS = 1_500_000

export interface ContextSummaryState {
  summary?: string
  summarizedTurnCount: number
}

/** Drop oldest tool-loop turns when conversation JSON exceeds budget. */
export function trimConversationHistory(contents: unknown[]): unknown[] {
  const serialized = () => JSON.stringify(contents)
  if (serialized().length <= MAX_CONTENT_CHARS) return contents

  const trimmed = [...contents]
  while (trimmed.length > 6 && serialized().length > MAX_CONTENT_CHARS) {
    trimmed.splice(4, 2)
  }
  return trimmed
}

export function needsContextSummary(contents: unknown[]): boolean {
  return JSON.stringify(contents).length > SUMMARY_THRESHOLD_CHARS
}

export function buildRunningSummary(contents: unknown[], turnCount: number): string {
  const recent = contents.slice(-6)
  const preview = recent
    .map((item, i) => {
      const role = (item as { role?: string }).role ?? 'unknown'
      const parts = (item as { parts?: Array<{ text?: string }> }).parts ?? []
      const text = parts
        .map((p) => p.text ?? '')
        .join(' ')
        .slice(0, 200)
      return `${i + 1}. [${role}] ${text}`
    })
    .join('\n')

  return `[Session summary after ${turnCount} turns]\nEarlier tool-loop turns were compressed to save context.\nRecent activity:\n${preview}`
}

export function injectContextSummary(
  contents: unknown[],
  summary: string
): unknown[] {
  if (contents.length < 4) return contents
  const summaryMessages = [
    { role: 'user', parts: [{ text: summary }] },
    {
      role: 'model',
      parts: [{ text: 'Understood. I will continue from the summarized state.' }]
    }
  ]
  return [contents[0], contents[1], ...summaryMessages, ...contents.slice(4)]
}

export function capToolResult(result: unknown, maxChars = 50_000): unknown {
  if (result === null || result === undefined) return result
  let serialized: string
  try {
    serialized = JSON.stringify(result)
  } catch {
    return result
  }
  if (serialized.length <= maxChars) return result
  return {
    truncated: true,
    preview: serialized.slice(0, maxChars),
    totalChars: serialized.length,
    hint: 'Tool result exceeded size limit. Use search_document or read fewer blocks at a time.'
  }
}

export function toolResultToResponse(toolResult: unknown): Record<string, unknown> {
  const capped = capToolResult(toolResult)
  if (capped === null || capped === undefined) return { output: null }
  if (typeof capped === 'object' && !Array.isArray(capped)) {
    const obj = capped as Record<string, unknown>
    if ('error' in obj) return { error: String(obj.error) }
    return obj
  }
  if (typeof capped === 'string') return { output: capped }
  return { output: capped }
}
