import { randomUUID } from 'crypto'
import type { WebContents } from 'electron'
import type {
  AgentSessionSnapshot,
  AgentStartPayload,
  AgentToolCallPayload,
  AgentToolResultPayload
} from '../../shared/agentSession'
import { DEFAULT_AGENT_CONFIG } from '../../shared/agentConfig'
import { AgentEventLog, getAgentSessionsDir } from './eventLog'
import { type ActiveLoop, abortLoopStreams, runAgentLoop } from './loopRunner'
import type { AgentSessionEvent } from '../../shared/agentSession'
import type { AiProvider } from '../../shared/models'

interface PendingRequest<T> {
  resolve: (value: T) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class AgentSessionManager {
  private readonly sessionsDir: string
  private readonly loops = new Map<string, ActiveLoop>()
  private pendingContext = new Map<string, PendingRequest<unknown[]>>()
  private pendingTools = new Map<string, PendingRequest<AgentToolResultPayload[]>>()

  constructor(userDataPath: string) {
    this.sessionsDir = getAgentSessionsDir(userDataPath)
  }

  listResumable(): AgentSessionSnapshot[] {
    return AgentEventLog.listResumable(this.sessionsDir)
  }

  emit(webContents: WebContents, event: AgentSessionEvent): void {
    try {
      webContents.send('agent:event', event)
    } catch {
      /* destroyed */
    }
  }

  resolveContext(sessionId: string, messages: unknown[]): void {
    const pending = this.pendingContext.get(sessionId)
    if (!pending) return
    clearTimeout(pending.timer)
    pending.resolve(messages)
    this.pendingContext.delete(sessionId)
  }

  resolveTools(sessionId: string, results: AgentToolResultPayload[]): void {
    const pending = this.pendingTools.get(sessionId)
    if (!pending) return
    clearTimeout(pending.timer)
    pending.resolve(results)
    this.pendingTools.delete(sessionId)
  }

  private requestContext(sessionId: string, full: boolean): Promise<unknown[]> {
    const loop = this.loops.get(sessionId)
    if (!loop) return Promise.resolve([])

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingContext.delete(sessionId)
        reject(new Error('Context request timed out'))
      }, DEFAULT_AGENT_CONFIG.toolCallTimeoutMs)

      this.pendingContext.set(sessionId, { resolve, reject, timer })
      loop.webContents.send('agent:request-context', { sessionId, full })
    })
  }

  private executeTools(
    sessionId: string,
    calls: AgentToolCallPayload[]
  ): Promise<AgentToolResultPayload[]> {
    const loop = this.loops.get(sessionId)
    if (!loop) return Promise.resolve([])

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingTools.delete(sessionId)
        reject(new Error('Tool execution timed out'))
      }, DEFAULT_AGENT_CONFIG.toolCallTimeoutMs)

      this.pendingTools.set(sessionId, { resolve, reject, timer })
      loop.webContents.send('agent:execute-tools', { sessionId, calls })
    })
  }

  async start(
    webContents: WebContents,
    payload: AgentStartPayload & {
      provider: AiProvider
      model: string
      temperature: number
      thinkingEnabled: boolean
      initialContents: unknown[]
      documentBlockCount?: number
    }
  ): Promise<string> {
    const sessionId = payload.resumeSessionId ?? randomUUID()

    if (this.loops.has(sessionId)) {
      this.cancel(sessionId)
    }

    const existing = payload.resumeSessionId
      ? AgentEventLog.listResumable(this.sessionsDir).find((s) => s.sessionId === sessionId)
      : null

    const snapshot: AgentSessionSnapshot = existing ?? {
      sessionId,
      status: 'running',
      mode: payload.mode,
      userMessage: payload.userMessage,
      provider: payload.provider,
      model: payload.model,
      temperature: payload.temperature,
      thinkingEnabled: payload.thinkingEnabled,
      stats: {
        stepCount: 0,
        segmentIndex: 0,
        startedAt: Date.now(),
        editToolCount: 0,
        nudgeCount: 0,
        statusLabel: 'Starting…'
      },
      contents: payload.initialContents,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    if (existing) {
      snapshot.status = 'running'
      snapshot.stats.startedAt = Date.now()
      snapshot.pendingContinue = false
      snapshot.incompleteReason = undefined
    }

    const log = new AgentEventLog(this.sessionsDir, sessionId)
    const loop: ActiveLoop = {
      sessionId,
      webContents,
      snapshot,
      log,
      abortController: new AbortController(),
      paused: false,
      cancelled: false,
      powerBlockerId: null,
      documentEdited: false,
      isFirstIteration: true,
      planNudgeCount: 0,
      submittedPlan: null,
      documentBlockCount: payload.documentBlockCount ?? 0,
      readToolsCalled: false,
      recentTurnToolKeys: [],
      consecutiveReadOnlyTurns: 0,
      circuitBreakerCount: 0,
      totalToolCalls: 0,
      nudgeReasons: [],
      deps: {
        requestContext: (sid, full) => this.requestContext(sid, full),
        executeTools: (sid, calls) => this.executeTools(sid, calls),
        emit: (wc, event) => this.emit(wc, event)
      },
      currentRequestId: null,
      currentStreamAbort: null
    }

    this.loops.set(sessionId, loop)
    log.saveSnapshot(snapshot)

    void runAgentLoop(loop).finally(() => {
      if (this.loops.get(sessionId) === loop) {
        this.loops.delete(sessionId)
      }
    })

    return sessionId
  }

  pause(sessionId: string): void {
    const loop = this.loops.get(sessionId)
    if (loop) loop.paused = true
  }

  resume(sessionId: string): void {
    const loop = this.loops.get(sessionId)
    if (loop && loop.paused) {
      loop.paused = false
      void runAgentLoop(loop)
    } else {
      const snap = AgentEventLog.listResumable(this.sessionsDir).find(
        (s) => s.sessionId === sessionId
      )
      if (snap) {
        // Will be restarted via start with resumeSessionId from renderer
      }
    }
  }

  cancel(sessionId: string): void {
    const loop = this.loops.get(sessionId)
    if (!loop) return

    loop.cancelled = true
    loop.abortController.abort()
    abortLoopStreams(loop)

    const ctxPending = this.pendingContext.get(sessionId)
    if (ctxPending) {
      clearTimeout(ctxPending.timer)
      ctxPending.reject(new Error('__CANCELLED__'))
      this.pendingContext.delete(sessionId)
    }

    const toolsPending = this.pendingTools.get(sessionId)
    if (toolsPending) {
      clearTimeout(toolsPending.timer)
      toolsPending.reject(new Error('__CANCELLED__'))
      this.pendingTools.delete(sessionId)
    }

    loop.snapshot.status = 'cancelled'
    loop.log.saveSnapshot(loop.snapshot)
    this.emit(loop.webContents, {
      type: 'session_cancelled',
      sessionId,
      at: Date.now()
    })
  }

  getActiveSessionId(webContents: WebContents): string | null {
    for (const [id, loop] of this.loops) {
      if (loop.webContents.id === webContents.id && !loop.cancelled) return id
    }
    return null
  }
}

let manager: AgentSessionManager | null = null

export function getAgentSessionManager(userDataPath: string): AgentSessionManager {
  if (!manager) manager = new AgentSessionManager(userDataPath)
  return manager
}
