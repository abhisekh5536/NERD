import type { AiChunk } from '../../preload/index'
import type { AiProvider } from '../../shared/models'
import type { RawLlmResponse, RawLlmTurn, ToolCallEvent } from './types'

export function serializeRawLlmResponse(raw: RawLlmResponse): string {
  return JSON.stringify(raw, null, 2)
}

export function buildRawLlmResponse(params: {
  provider: AiProvider
  model: string
  thinkingEnabled: boolean
  temperature: number
  turns: RawLlmTurn[]
  content?: string
  thoughts?: string
  toolCalls?: ToolCallEvent[]
}): RawLlmResponse {
  const { provider, model, thinkingEnabled, temperature, turns, content, thoughts, toolCalls } =
    params

  return {
    provider,
    model,
    thinkingEnabled,
    temperature,
    turns,
    ...(content ? { content } : {}),
    ...(thoughts ? { reasoning_content: thoughts } : {}),
    ...(toolCalls?.length ? { tool_calls: toolCalls } : {})
  }
}

export function rawLlmResponseFromMessage(message: {
  rawResponse?: RawLlmResponse
  content: string
  thoughts?: string
  toolCalls?: ToolCallEvent[]
}): RawLlmResponse | null {
  if (message.rawResponse) return message.rawResponse

  if (!message.thoughts && !message.toolCalls?.length) {
    return {
      provider: 'unknown',
      model: 'unknown',
      thinkingEnabled: false,
      temperature: 0,
      turns: [],
      content: message.content
    }
  }

  const chunks: AiChunk[] = []
  if (message.thoughts) {
    chunks.push({ type: 'thought', text: message.thoughts })
  }
  if (message.content) {
    chunks.push({ type: 'text', text: message.content })
  }
  if (message.toolCalls) {
    for (const tc of message.toolCalls) {
      chunks.push({
        type: 'functionCall',
        functionCall: { name: tc.name, args: tc.args, id: tc.id }
      })
    }
  }

  return {
    provider: 'unknown',
    model: 'unknown',
    thinkingEnabled: false,
    temperature: 0,
    turns: [{ chunks, modelParts: [] }],
    content: message.content,
    ...(message.thoughts ? { reasoning_content: message.thoughts } : {}),
    ...(message.toolCalls?.length ? { tool_calls: message.toolCalls } : {})
  }
}

export async function copyRawLlmResponse(raw: RawLlmResponse): Promise<void> {
  await navigator.clipboard.writeText(serializeRawLlmResponse(raw))
}
