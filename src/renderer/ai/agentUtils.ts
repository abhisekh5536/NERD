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

const READ_COMPRESS_TOOLS = new Set(['read_section', 'read_blocks', 'get_document_outline'])
const READ_COMPRESS_THRESHOLD = 30_000

/** Strip heavy formatting from large read results to reduce context bloat on subsequent turns. */
export function compressReadToolResult(name: string, result: unknown): unknown {
  if (!READ_COMPRESS_TOOLS.has(name) || typeof result !== 'object' || result === null) {
    return result
  }

  let serialized: string
  try {
    serialized = JSON.stringify(result)
  } catch {
    return result
  }
  if (serialized.length <= READ_COMPRESS_THRESHOLD) return result

  const payload = result as {
    blocks?: Array<Record<string, unknown>>
    entries?: unknown[]
  }

  if (Array.isArray(payload.blocks)) {
    return {
      ...payload,
      blocks: payload.blocks.map((block) => ({
        blockId: block.blockId,
        text:
          typeof block.text === 'string'
            ? block.text.slice(0, 800)
            : block.text,
        truncated: typeof block.text === 'string' && block.text.length > 800,
        blockStyle: block.blockStyle
      })),
      compressed: true,
      hint: 'Large read result compressed (runs omitted, text capped). Re-read specific blocks if offsets are needed.'
    }
  }

  return capToolResult(result, READ_COMPRESS_THRESHOLD)
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
