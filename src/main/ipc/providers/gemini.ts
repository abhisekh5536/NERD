import { GoogleGenAI } from '@google/genai'
import type { AiStreamPayload, ProviderStreamResult, StreamContext } from './types'
import { normalizeFinishReason, sendChunk } from './types'

export async function streamGemini(
  ctx: StreamContext,
  apiKey: string,
  payload: AiStreamPayload
): Promise<ProviderStreamResult> {
  const ai = new GoogleGenAI({ apiKey })
  const config: Record<string, unknown> = {
    temperature: payload.temperature,
    abortSignal: ctx.abortSignal
  }
  if (payload.thinkingEnabled) {
    config.thinkingConfig = { includeThoughts: true }
  }
  if (payload.tools && payload.tools.length > 0) {
    config.tools = payload.tools
  }

  const response = await ai.models.generateContentStream({
    model: payload.model,
    contents: payload.contents as never,
    config: config as never
  })

  let finishReason: ReturnType<typeof normalizeFinishReason> = 'unknown'
  let interrupted = false
  const emittedFunctionCalls = new Set<string>()

  for await (const chunk of response) {
    if (ctx.abortSignal.aborted || ctx.webContents.isDestroyed()) {
      interrupted = true
      break
    }

    const candidate = chunk.candidates?.[0]
    if (candidate?.finishReason) {
      finishReason = normalizeFinishReason(String(candidate.finishReason))
    }
    if (!candidate?.content?.parts) continue

    for (const part of candidate.content.parts) {
      if (ctx.abortSignal.aborted) {
        interrupted = true
        break
      }

      if (part.functionCall) {
        const name = part.functionCall.name ?? ''
        const args = (part.functionCall.args ?? {}) as Record<string, unknown>
        const id = part.functionCall.id
        const key = id ?? `${name}:${JSON.stringify(args)}`
        if (emittedFunctionCalls.has(key)) continue
        emittedFunctionCalls.add(key)
        sendChunk(ctx, {
          type: 'functionCall',
          functionCall: { name, args, id },
          thoughtSignature: part.thoughtSignature
        })
      } else if (part.text !== undefined && part.text !== null) {
        const isThought = Boolean((part as { thought?: boolean }).thought)
        sendChunk(ctx, {
          type: isThought ? 'thought' : 'text',
          text: part.text,
          thoughtSignature: part.thoughtSignature
        })
      }
    }
  }

  if (ctx.abortSignal.aborted && !ctx.webContents.isDestroyed()) {
    interrupted = true
  }

  return { meta: { finishReason, interrupted } }
}

export async function testGeminiKey(apiKey: string): Promise<void> {
  const ai = new GoogleGenAI({ apiKey })
  await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Reply with exactly: OK',
    config: { maxOutputTokens: 8 }
  })
}
