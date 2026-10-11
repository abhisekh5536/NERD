import type { WebContents } from 'electron'
import { powerSaveBlocker } from 'electron'
import type {
  AgentSessionEvent,
  AgentSessionSnapshot,
  AgentToolCallPayload,
  AgentToolResultPayload,
  StreamTurnMeta
} from '../../shared/agentSession'
import { DEFAULT_AGENT_CONFIG } from '../../shared/agentConfig'
import { EDIT_TOOL_NAMES, PLAN_NUDGE_MESSAGE, READ_TOOL_NAMES, RETRIEVAL_NUDGE_MESSAGE, CIRCUIT_BREAKER_MESSAGE } from '../../shared/agentPrompts'
import { ALL_TOOLS, PLAN_TOOLS } from '../../shared/agentTools'
import { decryptApiKey } from '../ipc/settings'
import { streamGemini } from '../ipc/providers/gemini'
import { streamOpenAICompatible } from '../ipc/providers/openaiCompatible'
import {
  sendDone,
  type AiChunkPayload,
  type StreamContext
} from '../ipc/providers/types'
import {
  buildRunningSummary,
  injectContextSummary,
  needsContextSummary,
  trimConversationHistory
} from './contextManager'
import { AgentEventLog } from './eventLog'
import { getRetryAfterMsFromError, isRetryableProviderError, withRetry } from './retry'

export interface LoopRunnerDeps {
  requestContext: (sessionId: string, full: boolean) => Promise<unknown[]>
  executeTools: (
    sessionId: string,
    calls: AgentToolCallPayload[]
  ) => Promise<AgentToolResultPayload[]>
  emit: (webContents: WebContents, event: AgentSessionEvent) => void
}

interface StreamFunctionCall {
  name: string
  args: Record<string, unknown>
  id?: string
}

interface StreamTurnResult {
  text: string
  functionCalls: StreamFunctionCall[]
  modelParts: Record<string, unknown>[]
  meta: StreamTurnMeta
}

export interface ActiveLoop {
  sessionId: string
  webContents: WebContents
  snapshot: AgentSessionSnapshot
  log: AgentEventLog
  abortController: AbortController
  paused: boolean
  cancelled: boolean
  powerBlockerId: number | null
  contextSummary?: string
  documentEdited: boolean
  isFirstIteration: boolean
  planNudgeCount: number
  submittedPlan: unknown | null
  documentBlockCount: number
  readToolsCalled: boolean
  recentTurnToolKeys: string[][]
  consecutiveReadOnlyTurns: number
  circuitBreakerCount: number
  totalToolCalls: number
  nudgeReasons: string[]
  deps: LoopRunnerDeps
  currentRequestId: string | null
  currentStreamAbort: AbortController | null
}

const activeStreamControllers = new Map<string, AbortController>()
let requestCounter = 0

function buildFunctionCallPart(
  fc: StreamFunctionCall,
  thoughtSignature?: string
): Record<string, unknown> {
  const part: Record<string, unknown> = {
    functionCall: {
      name: fc.name,
      args: fc.args,
      ...(fc.id ? { id: fc.id } : {})
    }
  }
  if (thoughtSignature) part.thoughtSignature = thoughtSignature
  return part
}

function functionCallKey(fc: StreamFunctionCall): string {
  if (fc.id) return fc.id
  return `${fc.name}:${JSON.stringify(fc.args)}`
}

function dedupeFunctionCalls(calls: StreamFunctionCall[]): StreamFunctionCall[] {
  const seen = new Set<string>()
  const out: StreamFunctionCall[] = []
  for (const fc of calls) {
    const key = functionCallKey(fc)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(fc)
  }
  return out
}

function stripThoughtPartsFromContents(contents: unknown[]): unknown[] {
  return contents.map((msg) => {
    if (typeof msg !== 'object' || msg === null) return msg
    const m = msg as { role?: string; parts?: unknown[] }
    if (!Array.isArray(m.parts)) return msg
    return {
      ...m,
      parts: m.parts.filter(
        (p) =>
          !(
            typeof p === 'object' &&
            p !== null &&
            (p as { thought?: boolean }).thought === true
          )
      )
    }
  })
}

function countToolKeyInRecentTurns(key: string, currentKeys: string[], recent: string[][]): number {
  let count = currentKeys.filter((k) => k === key).length
  for (const turn of recent) {
    if (turn.includes(key)) count++
  }
  return count
}

function shouldTripCircuitBreaker(
  loop: ActiveLoop,
  dedupedCalls: StreamFunctionCall[]
): boolean {
  if (dedupedCalls.length === 0) return false

  const callKeys = dedupedCalls.map(functionCallKey)
  const allReadOnly = dedupedCalls.every((c) => READ_TOOL_NAMES.has(c.name))
  const hasRepeat = callKeys.some(
    (key) => countToolKeyInRecentTurns(key, callKeys, loop.recentTurnToolKeys) >= 2
  )
  const pingPong =
    allReadOnly &&
    loop.consecutiveReadOnlyTurns >= 4 &&
    userAskedForEdits(loop.snapshot.userMessage) &&
    loop.snapshot.stats.editToolCount === 0

  return hasRepeat || pingPong
}

function recordToolTurn(
  loop: ActiveLoop,
  dedupedCalls: StreamFunctionCall[],
  options?: { countTowardTotal?: boolean }
): void {
  const callKeys = dedupedCalls.map(functionCallKey)
  loop.recentTurnToolKeys.push(callKeys)
  if (loop.recentTurnToolKeys.length > 3) {
    loop.recentTurnToolKeys.shift()
  }
  if (options?.countTowardTotal !== false) {
    loop.totalToolCalls += dedupedCalls.length
  }

  const allReadOnly = dedupedCalls.every((c) => READ_TOOL_NAMES.has(c.name))
  if (allReadOnly) {
    loop.consecutiveReadOnlyTurns++
  } else {
    loop.consecutiveReadOnlyTurns = 0
  }
}

function countSuccessfulEdits(tr: AgentToolResultPayload): number {
  if (tr.status !== 'done') return 0
  if (tr.name === 'batch_edit' || tr.name === 'insert_blocks') {
    const result = tr.result as { count?: number }
    return typeof result.count === 'number' && result.count > 0 ? result.count : 1
  }
  if (EDIT_TOOL_NAMES.has(tr.name)) return 1
  return 0
}

function logSessionMetrics(loop: ActiveLoop): void {
  const { stepCount, nudgeCount, editToolCount } = loop.snapshot.stats
  const toolsPerTurn = stepCount > 0 ? loop.totalToolCalls / stepCount : 0
  console.info('[agent] session metrics', {
    sessionId: loop.sessionId,
    stepCount,
    nudgeCount,
    editToolCount,
    circuitBreakerCount: loop.circuitBreakerCount,
    toolsPerTurn: Math.round(toolsPerTurn * 100) / 100,
    nudgeReasons: loop.nudgeReasons
  })
}

function updateStats(loop: ActiveLoop, statusLabel?: string): void {
  loop.snapshot.stats.statusLabel = statusLabel
  loop.snapshot.updatedAt = Date.now()
  loop.deps.emit(loop.webContents, {
    type: 'stats_updated',
    sessionId: loop.sessionId,
    stats: { ...loop.snapshot.stats }
  })
  loop.log.saveSnapshot(loop.snapshot)
}

function failSession(loop: ActiveLoop, reason: string): void {
  loop.snapshot.status = 'failed'
  loop.snapshot.pendingContinue = true
  loop.snapshot.incompleteReason = reason
  loop.deps.emit(loop.webContents, {
    type: 'session_failed',
    sessionId: loop.sessionId,
    reason,
    at: Date.now()
  })
  loop.log.saveSnapshot(loop.snapshot)
}

function isCancelledError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === '__CANCELLED__' || err.message.includes('cancel'))
  )
}

async function streamTurn(loop: ActiveLoop, requestId: string): Promise<StreamTurnResult> {
  if (loop.cancelled) {
    throw new Error('__CANCELLED__')
  }

  const controller = new AbortController()
  loop.currentRequestId = requestId
  loop.currentStreamAbort = controller
  activeStreamControllers.set(requestId, controller)
  const provider = loop.snapshot.provider
  const apiKey = decryptApiKey(provider)
  if (!apiKey) throw new Error('No API key configured.')

  const tools =
    loop.snapshot.mode === 'plan'
      ? [{ functionDeclarations: PLAN_TOOLS }]
      : [{ functionDeclarations: ALL_TOOLS }]

  let text = ''
  const functionCalls: StreamFunctionCall[] = []
  const modelParts: Record<string, unknown>[] = []
  let meta: StreamTurnMeta = { finishReason: 'unknown', interrupted: false }
  let hasReceivedFirstChunk = false
  let waitingForFirstAt = Date.now()
  let lastChunkAt = Date.now()
  let stallRetries = 0
  let seq = 0

  const runOnce = async (): Promise<StreamTurnResult> => {
    text = ''
    functionCalls.length = 0
    modelParts.length = 0
    meta = { finishReason: 'unknown', interrupted: false }
    hasReceivedFirstChunk = false
    waitingForFirstAt = Date.now()
    lastChunkAt = Date.now()
    updateStats(loop, `Connecting to model… · Step ${loop.snapshot.stats.stepCount}`)

    const ctx: StreamContext = {
      webContents: loop.webContents,
      requestId,
      abortSignal: controller.signal,
      onChunk: (chunk: AiChunkPayload) => {
        if (!hasReceivedFirstChunk) {
          hasReceivedFirstChunk = true
          updateStats(loop, `Running · Step ${loop.snapshot.stats.stepCount}`)
        }
        lastChunkAt = Date.now()
        seq++
        loop.deps.emit(loop.webContents, {
          type: 'chunk',
          sessionId: loop.sessionId,
          turnIndex: loop.snapshot.stats.stepCount,
          chunk,
          seq
        })
        if (chunk.type === 'thought' && chunk.text) {
          const thoughtPart: Record<string, unknown> = { text: chunk.text, thought: true }
          if (chunk.thoughtSignature) thoughtPart.thoughtSignature = chunk.thoughtSignature
          modelParts.push(thoughtPart)
        } else if (chunk.type === 'text' && chunk.text) {
          text += chunk.text
          const textPart: Record<string, unknown> = { text: chunk.text }
          if (chunk.thoughtSignature) textPart.thoughtSignature = chunk.thoughtSignature
          modelParts.push(textPart)
        } else if (chunk.type === 'functionCall' && chunk.functionCall) {
          const fc: StreamFunctionCall = {
            name: chunk.functionCall.name,
            args: chunk.functionCall.args ?? {},
            id: chunk.functionCall.id
          }
          const key = functionCallKey(fc)
          if (!functionCalls.some((existing) => functionCallKey(existing) === key)) {
            functionCalls.push(fc)
            modelParts.push(
              buildFunctionCallPart(fc, chunk.thoughtSignature)
            )
          }
        }
      }
    }

    const payload = {
      requestId,
      provider: loop.snapshot.provider,
      model: loop.snapshot.model,
      contents: stripThoughtPartsFromContents(loop.snapshot.contents),
      tools,
      thinkingEnabled: loop.snapshot.thinkingEnabled,
      temperature: loop.snapshot.temperature
    }

    const stallPromise = new Promise<never>((_, reject) => {
      const interval = setInterval(() => {
        const now = Date.now()
        const timedOut = !hasReceivedFirstChunk
          ? now - waitingForFirstAt >= DEFAULT_AGENT_CONFIG.firstTokenTimeoutMs
          : now - lastChunkAt >= DEFAULT_AGENT_CONFIG.stallTimeoutMs
        if (!timedOut) return
        clearInterval(interval)
        loop.deps.emit(loop.webContents, {
          type: 'stall_detected',
          sessionId: loop.sessionId,
          turnIndex: loop.snapshot.stats.stepCount,
          at: Date.now()
        })
        controller.abort()
        reject(new Error('__STALL__'))
      }, 5000)
      controller.signal.addEventListener('abort', () => clearInterval(interval), { once: true })
    })

    try {
      const streamPromise =
        provider === 'gemini'
          ? streamGemini(ctx, apiKey, payload)
          : streamOpenAICompatible(ctx, apiKey, provider, payload)

      const result = await Promise.race([streamPromise, stallPromise])
      meta = result.meta
      if (loop.cancelled) {
        throw new Error('__CANCELLED__')
      }
      sendDone(loop.webContents, requestId, meta)
      return { text, functionCalls: [...functionCalls], modelParts: [...modelParts], meta }
    } catch (err) {
      if (err instanceof Error && err.message === '__STALL__') {
        if (stallRetries < DEFAULT_AGENT_CONFIG.maxStallRetries) {
          stallRetries++
          updateStats(loop, 'Retrying stalled turn…')
          loop.deps.emit(loop.webContents, {
            type: 'turn_restarted',
            sessionId: loop.sessionId,
            turnIndex: loop.snapshot.stats.stepCount,
            reason: 'stall',
            at: Date.now()
          })
          return runOnce()
        }
        throw new Error('Request stalled with no progress. Click Continue to retry.')
      }
      if (controller.signal.aborted) {
        meta = { interrupted: true, finishReason: 'unknown' }
        sendDone(loop.webContents, requestId, meta)
        return { text, functionCalls: [...functionCalls], modelParts: [...modelParts], meta }
      }
      throw err
    }
  }

  try {
    return await withRetry(runOnce, {
      maxAttempts: DEFAULT_AGENT_CONFIG.maxTurnRetries,
      isRetryable: (err) => !loop.cancelled && isRetryableProviderError(err),
      getRetryAfterMs: getRetryAfterMsFromError
    })
  } finally {
    activeStreamControllers.delete(requestId)
    if (loop.currentRequestId === requestId) {
      loop.currentRequestId = null
      loop.currentStreamAbort = null
    }
  }
}

function evaluateContinuation(
  loop: ActiveLoop,
  result: StreamTurnResult
): { continue: boolean; message?: string; reason?: string } {
  if (result.functionCalls.length > 0) return { continue: false }
  if (loop.submittedPlan) return { continue: false }

  if (result.meta.interrupted || result.meta.finishReason === 'length') {
    if (loop.snapshot.stats.nudgeCount >= DEFAULT_AGENT_CONFIG.maxAgentNudges) {
      return { continue: false }
    }
    const reason = result.meta.interrupted ? 'interrupted' : 'length'
    return {
      continue: true,
      reason,
      message:
        reason === 'length'
          ? 'Continue generating from where you were cut off. Pick up exactly where the previous response ended.'
          : 'The previous response was interrupted. Continue from where you left off and complete the task using tools.'
    }
  }

  if (loop.snapshot.mode === 'plan') return { continue: false }

  const text = result.text.trim()
  const planning =
    loop.snapshot.stats.editToolCount === 0 &&
    /\b(i will now|i'll now|i'll start\b|i'll start by|going to start|next i will)\b/i.test(text) &&
    text.length > 0

  const needsEditNudge =
    loop.snapshot.stats.editToolCount === 0 && userAskedForEdits(loop.snapshot.userMessage)

  if (planning || (needsEditNudge && text.length <= 200)) {
    if (loop.snapshot.stats.nudgeCount >= DEFAULT_AGENT_CONFIG.maxAgentNudges) {
      return { continue: false }
    }
    return {
      continue: true,
      reason: planning ? 'planning_only' : 'no_edits',
      message: planning
        ? 'Continue working. Use edit tools to apply the changes you described — do not stop after planning text only.'
        : 'You have not applied document edits yet. Continue and use edit tools to complete the requested changes.'
    }
  }

  return { continue: false }
}

function userAskedForEdits(intent: string): boolean {
  const lower = intent.toLowerCase()
  return (
    /\b(edit|rewrite|format|insert|delete|replace|fix|update|change|add|remove|implement)\b/.test(
      lower
    ) || /\b(implement|execute|apply)\s+(the\s+)?plan\b/.test(lower)
  )
}

export async function runAgentLoop(loop: ActiveLoop): Promise<void> {
  if (loop.powerBlockerId === null) {
    loop.powerBlockerId = powerSaveBlocker.start('prevent-app-suspension')
  }

  loop.deps.emit(loop.webContents, {
    type: 'session_started',
    sessionId: loop.sessionId,
    mode: loop.snapshot.mode,
    at: Date.now()
  })

  const startedAt = loop.snapshot.stats.startedAt
  let segmentSteps = 0
  let totalSteps = 0

  try {
    while (!loop.cancelled) {
      if (loop.paused) {
        loop.snapshot.status = 'paused'
        loop.log.saveSnapshot(loop.snapshot)
        loop.deps.emit(loop.webContents, {
          type: 'session_paused',
          sessionId: loop.sessionId,
          at: Date.now()
        })
        return
      }

      if (Date.now() - startedAt > DEFAULT_AGENT_CONFIG.maxDurationMs) {
        loop.snapshot.pendingContinue = true
        loop.snapshot.incompleteReason = 'max_duration'
        break
      }

      if (totalSteps >= DEFAULT_AGENT_CONFIG.maxSteps) {
        loop.snapshot.pendingContinue = true
        loop.snapshot.incompleteReason = 'max_steps'
        const msg = `Reached step limit (${DEFAULT_AGENT_CONFIG.maxSteps}). Continuing…`
        loop.deps.emit(loop.webContents, {
          type: 'continuation_injected',
          sessionId: loop.sessionId,
          reason: 'max_steps',
          message: msg,
          at: Date.now()
        })
        loop.snapshot.contents = [
          ...loop.snapshot.contents,
          { role: 'user', parts: [{ text: msg }] }
        ]
        totalSteps = 0
        loop.snapshot.stats.segmentIndex++
        segmentSteps = 0
      }

      if (segmentSteps >= DEFAULT_AGENT_CONFIG.maxStepsPerSegment) {
        loop.deps.emit(loop.webContents, {
          type: 'segment_continued',
          sessionId: loop.sessionId,
          segmentIndex: loop.snapshot.stats.segmentIndex + 1,
          at: Date.now()
        })
        loop.snapshot.stats.segmentIndex++
        segmentSteps = 0
        const msg = `Reached step limit for this segment (${DEFAULT_AGENT_CONFIG.maxStepsPerSegment} steps). Continue the task from where you left off.`
        loop.deps.emit(loop.webContents, {
          type: 'continuation_injected',
          sessionId: loop.sessionId,
          reason: 'segment_limit',
          message: msg,
          at: Date.now()
        })
        loop.snapshot.contents = [
          ...loop.snapshot.contents,
          { role: 'user', parts: [{ text: msg }] }
        ]
      }

      loop.snapshot.contents = trimConversationHistory(loop.snapshot.contents)
      if (needsContextSummary(loop.snapshot.contents)) {
        loop.contextSummary = buildRunningSummary(
          loop.snapshot.contents,
          loop.snapshot.stats.stepCount
        )
        loop.snapshot.contents = injectContextSummary(loop.snapshot.contents, loop.contextSummary)
      }

      let contextMessages: unknown[]
      try {
        contextMessages = await loop.deps.requestContext(
          loop.sessionId,
          loop.isFirstIteration || loop.documentEdited
        )
      } catch (err) {
        if (loop.cancelled || isCancelledError(err)) {
          break
        }
        failSession(loop, err instanceof Error ? err.message : 'Context request failed')
        return
      }
      if (loop.cancelled) break
      loop.isFirstIteration = false
      loop.documentEdited = false
      loop.snapshot.contents = [
        loop.snapshot.contents[0],
        loop.snapshot.contents[1],
        ...contextMessages,
        ...loop.snapshot.contents.slice(4)
      ]

      const requestId = `req_${++requestCounter}_${Date.now()}`
      loop.snapshot.stats.stepCount++
      segmentSteps++
      totalSteps++
      updateStats(loop, `Running · Step ${loop.snapshot.stats.stepCount}`)

      loop.deps.emit(loop.webContents, {
        type: 'turn_started',
        sessionId: loop.sessionId,
        turnIndex: loop.snapshot.stats.stepCount,
        requestId,
        at: Date.now()
      })

      let result: StreamTurnResult
      try {
        result = await streamTurn(loop, requestId)
      } catch (err) {
        if (loop.cancelled || isCancelledError(err)) {
          break
        }
        failSession(loop, err instanceof Error ? err.message : 'Request failed')
        return
      }

      if (loop.cancelled) break

      loop.deps.emit(loop.webContents, {
        type: 'turn_completed',
        sessionId: loop.sessionId,
        turnIndex: loop.snapshot.stats.stepCount,
        at: Date.now()
      })
      loop.log.saveSnapshot(loop.snapshot)

      if (result.functionCalls.length > 0) {
        const functionResponseParts: unknown[] = []
        let planSubmittedThisTurn = false
        const dedupedCalls = dedupeFunctionCalls(result.functionCalls)

        if (shouldTripCircuitBreaker(loop, dedupedCalls)) {
          loop.circuitBreakerCount++
          recordToolTurn(loop, dedupedCalls, { countTowardTotal: false })
          loop.deps.emit(loop.webContents, {
            type: 'continuation_injected',
            sessionId: loop.sessionId,
            reason: 'circuit_breaker',
            message: CIRCUIT_BREAKER_MESSAGE,
            at: Date.now()
          })
          loop.snapshot.contents = [
            ...loop.snapshot.contents,
            { role: 'model', parts: result.modelParts },
            { role: 'user', parts: [{ text: CIRCUIT_BREAKER_MESSAGE }] }
          ]
          continue
        }

        loop.deps.emit(loop.webContents, {
          type: 'tool_call',
          sessionId: loop.sessionId,
          turnIndex: loop.snapshot.stats.stepCount,
          tool: dedupedCalls,
          at: Date.now()
        })

        let toolResults: AgentToolResultPayload[]
        try {
          toolResults = await loop.deps.executeTools(loop.sessionId, dedupedCalls)
        } catch (err) {
          if (loop.cancelled || isCancelledError(err)) {
            break
          }
          failSession(loop, err instanceof Error ? err.message : 'Tool execution failed')
          return
        }
        if (loop.cancelled) break

        for (const tr of toolResults) {
          loop.deps.emit(loop.webContents, {
            type: 'tool_result',
            sessionId: loop.sessionId,
            turnIndex: loop.snapshot.stats.stepCount,
            tool: tr,
            at: Date.now()
          })

          if (tr.name === 'submit_plan') {
            loop.submittedPlan = tr.result
            planSubmittedThisTurn = true
          } else if (READ_TOOL_NAMES.has(tr.name) && tr.status === 'done') {
            loop.readToolsCalled = true
          } else {
            const editCount = countSuccessfulEdits(tr)
            if (editCount > 0) {
              loop.snapshot.stats.editToolCount += editCount
              loop.documentEdited = true
            }
          }

          functionResponseParts.push({
            functionResponse: {
              name: tr.name,
              id: tr.id,
              response: tr.result
            }
          })
        }

        recordToolTurn(loop, dedupedCalls)

        loop.snapshot.contents = [
          ...loop.snapshot.contents,
          { role: 'model', parts: result.modelParts },
          { role: 'user', parts: functionResponseParts }
        ]

        if (planSubmittedThisTurn) break
      } else {
        if (loop.snapshot.mode === 'plan' && !loop.submittedPlan) {
          if (loop.planNudgeCount >= DEFAULT_AGENT_CONFIG.maxPlanNudges) break
          loop.planNudgeCount++
          loop.snapshot.contents = [
            ...loop.snapshot.contents,
            { role: 'model', parts: result.modelParts },
            { role: 'user', parts: [{ text: PLAN_NUDGE_MESSAGE }] }
          ]
          continue
        }

        const decision = evaluateContinuation(loop, result)
        if (
          !decision.continue &&
          !loop.readToolsCalled &&
          loop.documentBlockCount > 100 &&
          loop.snapshot.stats.nudgeCount < DEFAULT_AGENT_CONFIG.maxAgentNudges
        ) {
          loop.snapshot.stats.nudgeCount++
          loop.nudgeReasons.push('no_read')
          loop.deps.emit(loop.webContents, {
            type: 'continuation_injected',
            sessionId: loop.sessionId,
            reason: 'no_read',
            message: RETRIEVAL_NUDGE_MESSAGE,
            at: Date.now()
          })
          loop.snapshot.contents = [
            ...loop.snapshot.contents,
            { role: 'model', parts: result.modelParts },
            { role: 'user', parts: [{ text: RETRIEVAL_NUDGE_MESSAGE }] }
          ]
          continue
        }

        if (decision.continue && decision.message) {
          loop.snapshot.stats.nudgeCount++
          loop.nudgeReasons.push(decision.reason ?? 'continue')
          loop.deps.emit(loop.webContents, {
            type: 'continuation_injected',
            sessionId: loop.sessionId,
            reason: decision.reason ?? 'continue',
            message: decision.message,
            at: Date.now()
          })
          loop.snapshot.contents = [
            ...loop.snapshot.contents,
            { role: 'model', parts: result.modelParts },
            { role: 'user', parts: [{ text: decision.message }] }
          ]
          continue
        }

        break
      }
    }

    if (loop.cancelled) {
      if (loop.snapshot.status !== 'cancelled') {
        loop.snapshot.status = 'cancelled'
        loop.deps.emit(loop.webContents, {
          type: 'session_cancelled',
          sessionId: loop.sessionId,
          at: Date.now()
        })
      }
    } else if (loop.snapshot.pendingContinue) {
      loop.snapshot.status = 'paused'
      loop.deps.emit(loop.webContents, {
        type: 'session_paused',
        sessionId: loop.sessionId,
        reason: loop.snapshot.incompleteReason,
        at: Date.now()
      })
    } else {
      loop.snapshot.status = 'completed'
      logSessionMetrics(loop)
      loop.deps.emit(loop.webContents, {
        type: 'session_completed',
        sessionId: loop.sessionId,
        at: Date.now()
      })
    }
  } catch (err) {
    if (!loop.cancelled && !isCancelledError(err)) {
      failSession(loop, err instanceof Error ? err.message : 'Agent loop failed')
    }
  } finally {
    if (loop.powerBlockerId !== null && powerSaveBlocker.isStarted(loop.powerBlockerId)) {
      powerSaveBlocker.stop(loop.powerBlockerId)
      loop.powerBlockerId = null
    }
    loop.log.saveSnapshot(loop.snapshot)
  }
}

export function abortLoopStreams(loop: ActiveLoop): void {
  if (loop.currentStreamAbort) {
    loop.currentStreamAbort.abort()
  }
  if (loop.currentRequestId) {
    activeStreamControllers.get(loop.currentRequestId)?.abort()
  }
}

export function cancelStreamRequest(requestId: string): void {
  activeStreamControllers.get(requestId)?.abort()
}
