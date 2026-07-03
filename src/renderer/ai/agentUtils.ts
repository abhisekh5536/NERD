const MAX_CONTENT_CHARS = 2_000_000
export const MAX_TOOL_RESULT_CHARS = 50_000

/** Drop oldest tool-loop turns when conversation JSON exceeds budget. */
export function trimConversationHistory(contents: unknown[]): unknown[] {
  const serialized = () => JSON.stringify(contents)
  if (serialized().length <= MAX_CONTENT_CHARS) return contents

  const trimmed = [...contents]
  // Keep first 4 messages (system + context bootstrap), trim from index 4 onward.
  while (trimmed.length > 6 && serialized().length > MAX_CONTENT_CHARS) {
    trimmed.splice(4, 2)
  }
  return trimmed
}

/** Cap oversized tool results before sending back to the LLM. */
export function capToolResult(result: unknown, maxChars = MAX_TOOL_RESULT_CHARS): unknown {
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
