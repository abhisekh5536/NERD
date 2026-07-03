import OpenAI from 'openai'
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam
} from 'openai/resources/chat/completions'
import type { AiProvider } from '../../../shared/models'
import { isPekpikDeepSeekModel } from '../../../shared/models'
import { BASE_URL_BY_PROVIDER, TEST_MODEL_BY_PROVIDER } from '../../../shared/models'
import { getCustomOpenAIConfig } from '../settings'
import type { AiStreamPayload, ProviderStreamResult, StreamContext } from './types'
import { normalizeFinishReason, sendChunk } from './types'

interface GeminiPart {
  text?: string
  thought?: boolean
  reasoningContent?: string
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string }
  functionResponse?: {
    name: string
    id?: string
    response: Record<string, unknown>
  }
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

interface GeminiToolDeclaration {
  name: string
  description: string
  parametersJsonSchema: Record<string, unknown>
}

interface GeminiToolsWrapper {
  functionDeclarations: GeminiToolDeclaration[]
}

function extractText(parts: GeminiPart[]): string {
  return parts
    .filter((p) => p.text !== undefined && !p.thought)
    .map((p) => p.text ?? '')
    .join('')
}

function buildAssistantMessage(
  content: string | null,
  reasoning: string,
  toolCalls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
): ChatCompletionMessageParam {
  const msg: Record<string, unknown> = {
    role: 'assistant',
    content: content ?? null
  }
  if (reasoning) {
    msg.reasoning_content = reasoning
  }
  if (toolCalls?.length) {
    msg.tool_calls = toolCalls
  }
  return msg as unknown as ChatCompletionMessageParam
}

function geminiContentsToOpenAIMessages(contents: unknown[]): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = []
  let index = 0

  const first = contents[0] as GeminiContent | undefined
  if (first?.role === 'user' && first.parts?.length) {
    const systemText = extractText(first.parts)
    if (systemText) {
      messages.push({ role: 'system', content: systemText })
    }
    index = 2
  }

  for (let i = index; i < contents.length; i++) {
    const item = contents[i] as GeminiContent
    if (!item?.parts?.length) continue

    const functionResponses = item.parts.filter((p) => p.functionResponse)
    if (functionResponses.length > 0) {
      for (const part of functionResponses) {
        const fr = part.functionResponse!
        const toolMsg: ChatCompletionToolMessageParam = {
          role: 'tool',
          tool_call_id: fr.id ?? `call_${fr.name}`,
          content: JSON.stringify(fr.response)
        }
        messages.push(toolMsg)
      }
      continue
    }

    if (item.role === 'user') {
      const text = extractText(item.parts)
      if (text) {
        messages.push({ role: 'user', content: text })
      }
      continue
    }

    if (item.role === 'model') {
      const textParts = item.parts.filter((p) => p.text !== undefined && !p.thought && !p.reasoningContent)
      const thoughtParts = item.parts.filter((p) => (p.thought || p.reasoningContent) && (p.text || p.reasoningContent))
      const fcParts = item.parts.filter((p) => p.functionCall)

      const content = textParts.map((p) => p.text ?? '').join('') || null
      const reasoning =
        thoughtParts.map((p) => p.reasoningContent ?? p.text ?? '').join('') ||
        item.parts
          .filter((p) => p.reasoningContent)
          .map((p) => p.reasoningContent ?? '')
          .join('')

      if (fcParts.length > 0) {
        messages.push(
          buildAssistantMessage(
            content,
            reasoning,
            fcParts.map((p, idx) => ({
              id: p.functionCall!.id ?? `call_${p.functionCall!.name}_${idx}`,
              type: 'function' as const,
              function: {
                name: p.functionCall!.name,
                arguments: JSON.stringify(p.functionCall!.args ?? {})
              }
            }))
          )
        )
      } else if (content || reasoning) {
        messages.push(buildAssistantMessage(content, reasoning))
      }
    }
  }

  return messages
}

function geminiToolsToOpenAI(tools: unknown[] | undefined): ChatCompletionTool[] | undefined {
  if (!tools?.length) return undefined

  const wrapper = tools[0] as GeminiToolsWrapper
  if (!wrapper?.functionDeclarations?.length) return undefined

  return wrapper.functionDeclarations.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parametersJsonSchema
    }
  }))
}

function deepSeekUsesThinking(provider: AiProvider, model: string): boolean {
  return provider === 'other' && isPekpikDeepSeekModel(model)
}

function resolveProviderBaseUrl(provider: AiProvider): string {
  if (provider === 'custom') {
    const { baseUrl } = getCustomOpenAIConfig()
    if (!baseUrl) {
      throw new Error('No base URL configured. Open Settings and set a Base URL for OpenAI Compatible.')
    }
    return baseUrl
  }

  const baseURL = BASE_URL_BY_PROVIDER[provider]
  if (!baseURL) {
    throw new Error(`No base URL configured for provider: ${provider}`)
  }
  return baseURL
}

function buildCompletionParams(
  provider: AiProvider,
  payload: AiStreamPayload,
  openaiTools: ChatCompletionTool[] | undefined
): Record<string, unknown> {
  const customConfig = provider === 'custom' ? getCustomOpenAIConfig() : null

  return {
    model: payload.model,
    messages: geminiContentsToOpenAIMessages(payload.contents),
    tools: openaiTools,
    tool_choice: openaiTools ? 'auto' : undefined,
    temperature: payload.temperature,
    stream: true,
    ...(provider === 'cerebras' && payload.model === 'zai-glm-4.7'
      ? { reasoning_effort: payload.thinkingEnabled ? 'medium' : 'none' }
      : {}),
    ...(provider === 'custom' && customConfig?.supportsThinking
      ? { reasoning_effort: payload.thinkingEnabled ? 'medium' : 'none' }
      : {}),
    ...(deepSeekUsesThinking(provider, payload.model)
      ? {
          extra_body: {
            thinking: { type: payload.thinkingEnabled ? 'enabled' : 'disabled' }
          }
        }
      : {}),
    ...(customConfig?.extraBody ?? {})
  }
}

export async function streamOpenAICompatible(
  ctx: StreamContext,
  apiKey: string,
  provider: AiProvider,
  payload: AiStreamPayload
): Promise<ProviderStreamResult> {
  const baseURL = resolveProviderBaseUrl(provider)

  const client = new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: false
  })

  const openaiTools = geminiToolsToOpenAI(payload.tools)

  const stream = await client.chat.completions.create(
    buildCompletionParams(provider, payload, openaiTools) as unknown as ChatCompletionCreateParamsStreaming,
    { signal: ctx.abortSignal }
  )

  const pendingToolCalls = new Map<number, { id: string; name: string; arguments: string }>()
  const emittedToolIndices = new Set<number>()
  let finishReason: ReturnType<typeof normalizeFinishReason> = 'unknown'
  let interrupted = false

  const emitToolCallIfReady = (idx: number): void => {
    const tc = pendingToolCalls.get(idx)
    if (!tc?.name || emittedToolIndices.has(idx)) return
    emittedToolIndices.add(idx)
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(tc.arguments || '{}') as Record<string, unknown>
    } catch {
      args = {}
    }
    sendChunk(ctx, {
      type: 'functionCall',
      functionCall: { name: tc.name, args, id: tc.id }
    })
  }

  for await (const chunk of stream) {
    if (ctx.abortSignal.aborted || ctx.webContents.isDestroyed()) {
      interrupted = true
      break
    }

    const choice = chunk.choices[0]
    if (!choice) continue

    if (choice.finish_reason) {
      finishReason = normalizeFinishReason(choice.finish_reason)
    }

    const delta = choice.delta as {
      content?: string | null
      reasoning_content?: string | null
      reasoning?: string | null
      tool_calls?: Array<{
        index: number
        id?: string
        function?: { name?: string; arguments?: string }
      }>
    } | null

    if (!delta) continue

    const reasoning = delta.reasoning_content ?? delta.reasoning
    if (reasoning) {
      sendChunk(ctx, { type: 'thought', text: reasoning })
    }

    if (delta.content) {
      sendChunk(ctx, { type: 'text', text: delta.content })
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index
        if (!pendingToolCalls.has(idx)) {
          pendingToolCalls.set(idx, {
            id: tc.id ?? `call_${idx}`,
            name: tc.function?.name ?? '',
            arguments: tc.function?.arguments ?? ''
          })
        } else {
          const existing = pendingToolCalls.get(idx)!
          if (tc.id) existing.id = tc.id
          if (tc.function?.name) existing.name = tc.function.name
          if (tc.function?.arguments) existing.arguments += tc.function.arguments
        }
        emitToolCallIfReady(idx)
      }
    }
  }

  if (pendingToolCalls.size > 0) {
    finishReason = 'tool_calls'
  }

  for (const [idx] of pendingToolCalls) {
    emitToolCallIfReady(idx)
  }

  if (ctx.abortSignal.aborted && !ctx.webContents.isDestroyed()) {
    interrupted = true
  }

  return { meta: { finishReason, interrupted } }
}

export async function testOpenAICompatibleKey(
  apiKey: string,
  provider: AiProvider
): Promise<void> {
  const baseURL = resolveProviderBaseUrl(provider)
  const model =
    provider === 'custom' ? getCustomOpenAIConfig().model : TEST_MODEL_BY_PROVIDER[provider]

  if (!model.trim()) {
    throw new Error('No model configured. Open Settings and set a Model ID.')
  }

  const client = new OpenAI({ apiKey, baseURL })
  await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    max_tokens: 8
  })
}
