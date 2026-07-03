export interface RetryOptions {
  maxAttempts: number
  baseDelayMs?: number
  maxDelayMs?: number
  isRetryable: (err: unknown) => boolean
  getRetryAfterMs?: (err: unknown) => number | undefined
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitter(ms: number): number {
  return Math.round(ms * (0.75 + Math.random() * 0.5))
}

export function isRetryableProviderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  if (lower.includes('401') || lower.includes('invalid api key') || lower.includes('403')) {
    return false
  }
  if (
    lower.includes('429') ||
    lower.includes('rate') ||
    lower.includes('quota') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('econnreset') ||
    lower.includes('network') ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('500') ||
    lower.includes('fetch failed') ||
    lower.includes('socket')
  ) {
    return true
  }
  return false
}

export function getRetryAfterMsFromError(err: unknown): number | undefined {
  const msg = err instanceof Error ? err.message : String(err)
  const match = msg.match(/retry[- ]after[:\s]+(\d+)/i)
  if (match) return Number(match[1]) * 1000
  return undefined
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const baseDelayMs = options.baseDelayMs ?? 1000
  const maxDelayMs = options.maxDelayMs ?? 30_000
  let lastError: unknown

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt >= options.maxAttempts || !options.isRetryable(err)) {
        throw err
      }
      const retryAfter = options.getRetryAfterMs?.(err)
      const delay = jitter(
        Math.min(maxDelayMs, retryAfter ?? baseDelayMs * 2 ** (attempt - 1))
      )
      await sleep(delay)
    }
  }

  throw lastError
}
