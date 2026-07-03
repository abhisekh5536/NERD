import type { Editor } from '@tiptap/core'
import {
  useAiStore,
  nextMsgId,
  nextPlanId,
  blocksToLegacyContent
} from '../store/aiStore'
import { buildSystemPrompt, buildPlanSystemPrompt, buildContextMessages } from './prompt'
import { buildDocumentOutlineView } from './docService'
import { executeToolCall } from './toolDispatcher'
import { capToolResult, toolResultToResponse } from './agentUtils'
import type { AiChunk } from '../../preload/index'
import type {
  AgentSessionEvent,
  AgentStartPayload,
  AgentToolCallPayload,
  AgentToolResultPayload
} from '../../shared/agentSession'
import type { AgentMode, ImplementationPlan, PlanTodo, ToolCallEvent } from './types'

let sessionClientInitialized = false
let activeSessionId: string | null = null
let activeEditor: Editor | null = null
let pendingCancel = false
let ipcUnsubscribers: Array<() => void> = []

function toolCallId(name: string, providerId?: string): string {
  return providerId ?? `tc_${name}_${Date.now()}`
}

function registerToolCalls(
  calls: Array<{ name: string; args?: Record<string, unknown>; id?: string }>
): void {
  const store = useAiStore.getState()
  for (const fc of calls) {
    if (!fc.name) continue
    store.addToolCall({
      id: toolCallId(fc.name, fc.id),
      name: fc.name,
      args: fc.args ?? {},
      status: 'running'
    })
  }
}

function findRunningTool(
  tr: AgentToolResultPayload,
  tools: ToolCallEvent[],
  streamBlocks: ReturnType<typeof useAiStore.getState>['streamBlocks']
): ToolCallEvent | undefined {
  const fromActive =
    tr.id != null
      ? tools.find((t) => t.id === tr.id && t.status === 'running') ??
        [...tools].reverse().find((t) => t.name === tr.name && t.status === 'running')
      : [...tools].reverse().find((t) => t.name === tr.name && t.status === 'running')
  if (fromActive) return fromActive

  for (let i = streamBlocks.length - 1; i >= 0; i--) {
    const block = streamBlocks[i]
    if (block.type !== 'tool' || block.tool.status !== 'running') continue
    if (tr.id != null && block.tool.id === tr.id) return block.tool
    if (block.tool.name === tr.name) return block.tool
  }
  return undefined
}

function parseTodosFromPlanMarkdown(markdown: string): PlanTodo[] {
  const proposedSection = markdown.match(/## Proposed Changes([\s\S]*?)(?=## |$)/i)
  if (!proposedSection) return []

  const todos: PlanTodo[] = []
  let index = 0
  for (const line of proposedSection[1].split('\n')) {
    const match = line.match(/^\s*\d+\.\s+(.+)/)
    if (match) {
      index++
      todos.push({
        id: `todo-${index}`,
        content: match[1].trim(),
        status: 'pending'
      })
    }
  }
  return todos
}

function buildPlanFromSubmitArgs(args: Record<string, unknown>): ImplementationPlan {
  const title = String(args.title ?? 'Implementation Plan')
  const overview = args.overview ? String(args.overview) : undefined
  const markdown = String(args.plan ?? '').trim()

  if (!markdown) {
    throw new Error('submit_plan requires non-empty plan markdown')
  }

  const rawTodos = (args.todos as Array<{ id?: string; content?: string }>) ?? []
  let todos: PlanTodo[] = rawTodos
    .filter((t) => t.content?.trim())
    .map((t, i) => ({
      id: t.id ?? `todo-${i + 1}`,
      content: t.content!.trim(),
      status: 'pending' as const
    }))

  if (todos.length === 0) {
    todos = parseTodosFromPlanMarkdown(markdown)
  }

  if (todos.length === 0) {
    throw new Error('submit_plan requires at least one todo in todos array')
  }

  return {
    id: nextPlanId(),
    title,
    overview,
    markdown,
    todos,
    status: 'draft',
    createdAt: Date.now()
  }
}

function buildInitialContents(
  editor: Editor,
  userMessage: string,
  mode: AgentMode,
  skipUserMessage: boolean
): unknown[] {
  const store = useAiStore.getState()
  const systemPrompt = mode === 'plan' ? buildPlanSystemPrompt() : buildSystemPrompt()

  const history = store.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-40)
    .map((m) => {
      if (m.role === 'user') {
        return { role: 'user' as const, parts: [{ text: m.content }] }
      }
      const parts: Record<string, unknown>[] = []
      if (m.thoughts) parts.push({ text: m.thoughts, thought: true })
      if (m.content) parts.push({ text: m.content })
      return {
        role: 'model' as const,
        parts: parts.length > 0 ? parts : [{ text: '' }]
      }
    })

  const base: unknown[] = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] },
    ...buildContextMessages(editor),
    ...history.slice(0, skipUserMessage ? history.length : -1)
  ]

  if (!skipUserMessage) {
    base.push({ role: 'user', parts: [{ text: userMessage }] })
  }

  return base
}

function applyChunkToStore(chunk: AiChunk): void {
  const store = useAiStore.getState()
  if (chunk.type === 'thought' && chunk.text) {
    store.appendThought(chunk.text)
  } else if (chunk.type === 'text' && chunk.text) {
    store.appendText(chunk.text)
  } else if (chunk.type === 'functionCall' && chunk.functionCall) {
    registerToolCalls([
      {
        name: chunk.functionCall.name,
        args: chunk.functionCall.args,
        id: chunk.functionCall.id
      }
    ])
  }
}

function handleSessionEvent(event: AgentSessionEvent): void {
  const store = useAiStore.getState()

  switch (event.type) {
    case 'session_started':
      store.setRunStats({ ...store.runStats, statusLabel: 'Starting session…' })
      break
    case 'stats_updated':
      store.setRunStats(event.stats)
      break
    case 'turn_started':
      store.resetStreamBuffers()
      store.setStreamingRaw(null)
      break
    case 'chunk':
      applyChunkToStore(event.chunk as AiChunk)
      break
    case 'tool_call': {
      registerToolCalls(event.tool as AgentToolCallPayload[])
      break
    }
    case 'tool_result': {
      const tr = event.tool as AgentToolResultPayload
      const state = useAiStore.getState()
      const match = findRunningTool(tr, state.activeTools, state.streamBlocks)
      if (match) {
        const resultStr =
          typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result).slice(0, 200)
        store.updateToolCall(match.id, {
          status: tr.status,
          result: tr.status === 'error' ? String(tr.result.error ?? resultStr) : resultStr
        })
      }

      if (tr.name === 'submit_plan' && tr.status === 'done') {
        try {
          const plan = buildPlanFromSubmitArgs(tr.args)
          store.registerPlan(plan)
          store.appendPlanBlock(plan.id, plan.title)
          store.setPlanPanelOpen(true)
        } catch {
          /* invalid plan payload */
        }
      }
      break
    }
    case 'turn_restarted':
      store.resetStreamBuffers()
      store.setRunStats({ ...store.runStats, statusLabel: 'Retrying turn…' })
      break
    case 'stall_detected':
      store.setRunStats({ ...store.runStats, statusLabel: 'Model slow — retrying…' })
      break
    case 'continuation_injected':
      store.setRunStats({ ...store.runStats, statusLabel: 'Continuing…' })
      break
    case 'session_completed':
    case 'session_failed':
    case 'session_cancelled':
      finalizeSession(event.type, event.reason)
      break
    case 'session_paused':
      finalizeSession(event.type, event.reason)
      if (activeSessionId) {
        useAiStore.getState().setPendingContinue(true, activeSessionId, event.reason)
      }
      break
    default:
      break
  }
}

function finalizeSession(
  type: AgentSessionEvent['type'],
  reason?: string
): void {
  const store = useAiStore.getState()
  if (type === 'session_cancelled' && !store.streaming && !activeSessionId && !pendingCancel) {
    return
  }
  if (type === 'session_failed' && reason) {
    store.addMessage({
      id: nextMsgId(),
      role: 'assistant',
      content: `Error: ${reason}`,
      timestamp: Date.now()
    })
  } else if (type === 'session_completed' || type === 'session_paused' || type === 'session_cancelled') {
    const finalState = useAiStore.getState()
    const blocks = [...finalState.streamBlocks]
    const legacy = blocksToLegacyContent(blocks)
    const content =
      legacy.content ||
      finalState.currentText.trim() ||
      (type === 'session_paused' && reason
        ? `Session paused (${reason}). Click Continue to resume.`
        : type === 'session_cancelled'
          ? ''
          : '')

    const hasAssistantOutput =
      Boolean(content) ||
      Boolean(legacy.thoughts) ||
      Boolean(legacy.toolCalls?.length) ||
      blocks.some((b) => b.type === 'tool' || b.type === 'suggestion')

    if (hasAssistantOutput) {
      store.addMessage({
        id: nextMsgId(),
        role: 'assistant',
        content: content || '',
        thoughts: legacy.thoughts || undefined,
        toolCalls: legacy.toolCalls,
        blocks: blocks.length > 0 ? blocks : undefined,
        timestamp: Date.now()
      })
    } else if (type === 'session_paused') {
      store.setPendingContinue(true, activeSessionId, reason)
    }
  }

  store.setStreaming(false)
  store.setStreamingRaw(null)
  store.resetStreamBuffers()
  store.setActiveSessionId(null)
  useAiStore.setState({ streamBlocks: [] })
  if (type === 'session_completed' || type === 'session_cancelled') {
    activeSessionId = null
    pendingCancel = false
  }
}

function teardownIpcHandlers(): void {
  for (const unsub of ipcUnsubscribers) {
    unsub()
  }
  ipcUnsubscribers = []
  sessionClientInitialized = false
}

function ensureIpcHandlers(editor: Editor): void {
  if (sessionClientInitialized) return
  sessionClientInitialized = true
  activeEditor = editor

  ipcUnsubscribers.push(
    window.api.agent.onRequestContext(async (payload) => {
    if (pendingCancel) {
      await window.api.agent.provideContext(payload.sessionId, [])
      return
    }

    const ed = activeEditor
    if (!ed) {
      await window.api.agent.provideContext(payload.sessionId, [])
      return
    }
    const messages = buildContextMessages(ed, { full: payload.full })
    await window.api.agent.provideContext(payload.sessionId, messages)
    })
  )

  ipcUnsubscribers.push(
    window.api.agent.onExecuteTools(async (payload) => {
    if (pendingCancel) {
      await window.api.agent.provideToolResults(
        payload.sessionId,
        payload.calls.map((call) => ({
          name: call.name,
          id: call.id,
          args: call.args,
          result: { error: 'Cancelled' },
          status: 'error' as const
        }))
      )
      return
    }

    const ed = activeEditor
    const results: AgentToolResultPayload[] = []
    for (const call of payload.calls) {
      try {
        if (!ed) throw new Error('Editor unavailable')
        const toolResult = executeToolCall(ed, call.name, call.args)
        const capped = capToolResult(toolResult)
        const response = toolResultToResponse(capped)
        const hasError =
          typeof response === 'object' && response !== null && 'error' in response
        results.push({
          name: call.name,
          id: call.id,
          args: call.args,
          result: response,
          status: hasError ? 'error' : 'done'
        })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Tool execution failed'
        results.push({
          name: call.name,
          id: call.id,
          args: call.args,
          result: { error: errMsg },
          status: 'error'
        })
      }
    }
    await window.api.agent.provideToolResults(payload.sessionId, results)
    })
  )

  ipcUnsubscribers.push(
    window.api.agent.onEvent((event) => {
      handleSessionEvent(event)
    })
  )
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    const ed = activeEditor
    teardownIpcHandlers()
    if (ed) ensureIpcHandlers(ed)
  })
}

export class AgentSessionClient {
  private editor: Editor
  private sessionId: string | null = null
  private cancelRequested = false

  constructor(editor: Editor) {
    this.editor = editor
    activeEditor = editor
    ensureIpcHandlers(editor)
  }

  cancel(): void {
    this.cancelRequested = true
    pendingCancel = true

    const sessionId =
      this.sessionId ?? useAiStore.getState().activeSessionId ?? activeSessionId

    const store = useAiStore.getState()
    store.setRunStats({
      ...store.runStats,
      statusLabel: 'Stopping…'
    })

    if (sessionId) {
      store.setStreaming(false)
      void window.api.agent.cancel(sessionId)
    } else {
      store.setStreaming(false)
      store.setStreamingRaw(null)
      store.resetStreamBuffers()
      useAiStore.setState({ streamBlocks: [] })
      pendingCancel = false
    }
  }

  async runFromPlan(plan: ImplementationPlan): Promise<void> {
    const store = useAiStore.getState()
    const currentPlan = store.plans[plan.id] ?? plan
    store.setPlanStatus(currentPlan.id, 'building')

    const todosText =
      currentPlan.todos?.map((t) => `- [ ] ${t.content}`).join('\n') ?? ''
    const message = `Implement the following approved plan. Follow each step and use edit tools.

# ${currentPlan.title}

${currentPlan.markdown}${todosText ? `\n\n## Todos\n${todosText}` : ''}`

    try {
      await this.run(message, { mode: 'agent' })
      store.setPlanStatus(currentPlan.id, 'done')
    } catch (err) {
      store.setPlanStatus(currentPlan.id, 'draft')
      throw err
    }
  }

  async run(
    userMessage: string,
    options: { mode?: AgentMode; skipUserMessage?: boolean; resumeSessionId?: string } = {}
  ): Promise<void> {
    const store = useAiStore.getState()
    this.cancelRequested = false
    pendingCancel = false
    this.sessionId = null

    const mode = options.mode ?? store.agentMode

    if (!options.skipUserMessage && !options.resumeSessionId) {
      store.addMessage({
        id: nextMsgId(),
        role: 'user',
        content: userMessage,
        timestamp: Date.now()
      })
    }

    store.setStreaming(true)
    store.clearStreamBlocks()
    store.setRunStats({
      stepCount: 0,
      segmentIndex: 0,
      startedAt: Date.now(),
      editToolCount: 0,
      nudgeCount: 0,
      statusLabel: 'Starting…'
    })

    const initialContents = buildInitialContents(
      this.editor,
      userMessage,
      mode,
      options.skipUserMessage ?? false
    )

    const payload: AgentStartPayload & { initialContents: unknown[] } = {
      userMessage,
      mode,
      skipUserMessage: options.skipUserMessage,
      resumeSessionId: options.resumeSessionId,
      documentBlockCount: buildDocumentOutlineView(this.editor).blockCount,
      initialContents
    }

    const { sessionId } = await window.api.agent.start(payload)

    if (this.cancelRequested || pendingCancel) {
      void window.api.agent.cancel(sessionId)
      return
    }

    this.sessionId = sessionId
    activeSessionId = sessionId
    store.setActiveSessionId(sessionId)
  }

  static async listResumable() {
    return window.api.agent.listResumable()
  }

  static async resume(sessionId: string, editor: Editor): Promise<void> {
    const client = new AgentSessionClient(editor)
    const sessions = await window.api.agent.listResumable()
    const snap = sessions.find((s) => s.sessionId === sessionId)
    if (!snap) return
    await client.run(snap.userMessage, {
      mode: snap.mode,
      skipUserMessage: true,
      resumeSessionId: sessionId
    })
  }
}

/** @deprecated Use AgentSessionClient — kept for type compatibility */
export { AgentSessionClient as AgentController }
