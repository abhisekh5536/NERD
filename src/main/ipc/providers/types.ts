import type { WebContents } from 'electron'
import type { AiProvider } from '../../../shared/models'
import type { StreamFinishReason, StreamTurnMeta } from '../../../shared/agentSession'

export interface AiStreamPayload {
  requestId: string
  provider: AiProvider
  model: string
  contents: unknown[]
  tools?: unknown[]
  thinkingEnabled: boolean
  temperature: number
}

export interface AiChunkPayload {
  type: 'thought' | 'text' | 'functionCall'
  text?: string
  functionCall?: { name: string; args: Record<string, unknown>; id?: string }
  thoughtSignature?: string
}

export interface StreamContext {
  webContents: WebContents
  requestId: string
  abortSignal: AbortSignal
  onChunk?: (chunk: AiChunkPayload) => void
}

export interface ProviderStreamResult {
  meta: StreamTurnMeta
}

export function sendChunk(ctx: StreamContext, chunk: AiChunkPayload): void {
  if (ctx.abortSignal.aborted || ctx.webContents.isDestroyed()) return
  ctx.onChunk?.(chunk)
  ctx.webContents.send(`ai:chunk:${ctx.requestId}`, chunk)
}

export function sendError(sender: Electron.WebContents, requestId: string, error: string): void {
  try {
    sender.send(`ai:error:${requestId}`, { error })
  } catch {
    /* sender destroyed */
  }
}

export interface AiStreamDonePayload {
  finishReason?: StreamFinishReason
  interrupted?: boolean
}

export function sendDone(
  sender: Electron.WebContents,
  requestId: string,
  meta: StreamTurnMeta = {}
): void {
  try {
    sender.send(`ai:done:${requestId}`, meta)
  } catch {
    /* sender destroyed */
  }
}

export function normalizeFinishReason(raw?: string | null): StreamFinishReason {
  if (!raw) return 'unknown'
  const lower = raw.toLowerCase()
  if (lower === 'stop') return 'stop'
  if (lower === 'length' || lower === 'max_tokens') return 'length'
  if (lower.includes('tool')) return 'tool_calls'
  if (lower.includes('error') || lower.includes('safety')) return 'error'
  return 'unknown'
}

export function formatProviderError(provider: AiProvider, err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()
  const providerLabels: Record<AiProvider, string> = {
    gemini: 'Gemini',
    groq: 'Groq',
    grok: 'Grok',
    cerebras: 'Cerebras',
    other: 'Other',
    custom: 'OpenAI Compatible'
  }
  const providerLabel = providerLabels[provider]

  if (lower.includes('api key') || lower.includes('api_key') || lower.includes('401') || lower.includes('invalid')) {
    return `Invalid API key. Check your ${providerLabel} API key in Settings.`
  }
  if (lower.includes('quota') || lower.includes('429') || lower.includes('rate')) {
    return 'API quota or rate limit exceeded. Try again later or switch models.'
  }
  if (provider === 'gemini' && (lower.includes('thought_signature') || lower.includes('thoughtsignature'))) {
    return 'Tool calling failed: missing thought signature. Update the app or try gemini-2.5-flash with thinking enabled.'
  }
  if (lower.includes('not found') || lower.includes('404') || (lower.includes('model') && !lower.includes('function call'))) {
    return `Model not available: ${raw}. Try a different model in Settings.`
  }
  if (lower.includes('aborted') || lower.includes('abort')) {
    return 'Request cancelled.'
  }
  return raw || `Unknown error communicating with ${providerLabel}.`
}
