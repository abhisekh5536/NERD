import { create } from 'zustand'
import type {
  AgentMode,
  AssistantBlock,
  ChatMessage,
  ImplementationPlan,
  ToolCallEvent,
  PendingSuggestion,
  PlanStatus,
  RawLlmResponse,
  SuggestionStatus
} from '../ai/types'
import { getPendingFromBlocks as extractPending } from '../ai/types'
import type { AiProvider } from '../../shared/models'
import type { AgentRunStats } from '../../shared/agentSession'

export type { AgentMode, ImplementationPlan }

let _planCounter = 0
export const nextPlanId = (): string => `plan_${++_planCounter}_${Date.now()}`

function nextBlockId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function syncPendingFromBlocks(blocks: AssistantBlock[]): PendingSuggestion[] {
  return extractPending(blocks)
}

function computePendingSuggestions(
  streaming: boolean,
  streamBlocks: AssistantBlock[],
  messages: ChatMessage[]
): PendingSuggestion[] {
  if (streaming) return syncPendingFromBlocks(streamBlocks)
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'assistant' && msg.blocks?.length) {
      const pending = syncPendingFromBlocks(msg.blocks)
      if (pending.length > 0) return pending
    }
  }
  return []
}

interface AiState {
  panelOpen: boolean
  panelWidth: number
  messages: ChatMessage[]
  streaming: boolean
  streamBlocks: AssistantBlock[]
  currentThought: string
  currentText: string
  activeTools: ToolCallEvent[]
  pendingSuggestions: PendingSuggestion[]
  hasApiKey: boolean
  provider: AiProvider
  modelName: string
  streamingRaw: RawLlmResponse | null
  agentMode: AgentMode
  activePlan: ImplementationPlan | null
  plans: Record<string, ImplementationPlan>
  planPanelOpen: boolean
  runStats: AgentRunStats
  activeSessionId: string | null
  pendingContinue: boolean
  pendingContinueSessionId: string | null
  pendingContinueReason?: string

  togglePanel: () => void
  setPanelOpen: (open: boolean) => void
  setPanelWidth: (width: number) => void
  setHasApiKey: (has: boolean) => void
  setProvider: (provider: AiProvider) => void
  setModelName: (name: string) => void
  setStreamingRaw: (raw: RawLlmResponse | null) => void
  setAgentMode: (mode: AgentMode) => void
  setActivePlan: (plan: ImplementationPlan | null) => void
  registerPlan: (plan: ImplementationPlan) => void
  updatePlanMarkdown: (markdown: string) => void
  setPlanStatus: (planId: string, status: PlanStatus) => void
  setPlanPanelOpen: (open: boolean) => void
  openPlanPanel: (planId?: string) => void

  addMessage: (msg: ChatMessage) => void
  clearMessages: () => void
  setStreaming: (s: boolean) => void
  appendThought: (text: string) => void
  appendText: (text: string) => void
  resetStreamBuffers: () => void
  clearStreamBlocks: () => void

  addToolCall: (tc: ToolCallEvent) => void
  updateToolCall: (id: string, update: Partial<ToolCallEvent>) => void
  clearActiveTools: () => void
  appendPlanBlock: (planId: string, title: string) => void

  addSuggestion: (s: PendingSuggestion) => void
  setSuggestionStatus: (id: string, status: SuggestionStatus) => void
  setSuggestionStatusInMessage: (messageId: string, suggestionId: string, status: SuggestionStatus) => void
  markAllSuggestionsStatus: (status: SuggestionStatus) => void
  removeSuggestion: (id: string) => void
  clearSuggestions: () => void

  setRunStats: (stats: AgentRunStats) => void
  setActiveSessionId: (id: string | null) => void
  setPendingContinue: (pending: boolean, sessionId?: string | null, reason?: string) => void
}

let _msgCounter = 0
export const nextMsgId = (): string => `msg_${++_msgCounter}_${Date.now()}`

export const useAiStore = create<AiState>((set) => ({
  panelOpen: false,
  panelWidth: 380,
  messages: [],
  streaming: false,
  streamBlocks: [],
  currentThought: '',
  currentText: '',
  activeTools: [],
  pendingSuggestions: [],
  hasApiKey: false,
  provider: 'gemini',
  modelName: 'gemini-2.5-flash',
  streamingRaw: null,
  agentMode: 'agent',
  activePlan: null,
  plans: {},
  planPanelOpen: false,
  runStats: {
    stepCount: 0,
    segmentIndex: 0,
    startedAt: 0,
    editToolCount: 0,
    nudgeCount: 0
  },
  activeSessionId: null,
  pendingContinue: false,
  pendingContinueSessionId: null,
  pendingContinueReason: undefined,

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setPanelWidth: (panelWidth) => set({ panelWidth }),
  setHasApiKey: (hasApiKey) => set({ hasApiKey }),
  setProvider: (provider) => set({ provider }),
  setModelName: (modelName) => set({ modelName }),
  setStreamingRaw: (streamingRaw) => set({ streamingRaw }),
  setAgentMode: (agentMode) => set({ agentMode }),
  setActivePlan: (activePlan) => set({ activePlan }),
  registerPlan: (plan) =>
    set((s) => ({
      plans: { ...s.plans, [plan.id]: plan },
      activePlan: plan
    })),
  updatePlanMarkdown: (markdown) =>
    set((s) => {
      if (!s.activePlan) return {}
      const updated = { ...s.activePlan, markdown }
      return {
        activePlan: updated,
        plans: { ...s.plans, [updated.id]: updated }
      }
    }),
  setPlanStatus: (planId, status) =>
    set((s) => {
      const existing = s.plans[planId]
      if (!existing) return {}
      const updated = { ...existing, status }
      return {
        plans: { ...s.plans, [planId]: updated },
        activePlan: s.activePlan?.id === planId ? updated : s.activePlan
      }
    }),
  setPlanPanelOpen: (planPanelOpen) => set({ planPanelOpen }),
  openPlanPanel: (planId) =>
    set((s) => {
      if (planId && s.plans[planId]) {
        return { activePlan: s.plans[planId], planPanelOpen: true }
      }
      return { planPanelOpen: true }
    }),

  addMessage: (msg) =>
    set((s) => {
      const messages = [...s.messages, msg]
      return {
        messages,
        pendingSuggestions: computePendingSuggestions(s.streaming, s.streamBlocks, messages)
      }
    }),
  clearMessages: () => set({ messages: [], pendingSuggestions: [], streamBlocks: [] }),
  setStreaming: (streaming) =>
    set((s) => ({
      streaming,
      pendingSuggestions: computePendingSuggestions(streaming, s.streamBlocks, s.messages)
    })),
  appendThought: (text) =>
    set((s) => {
      const streamBlocks = [...s.streamBlocks]
      const last = streamBlocks[streamBlocks.length - 1]
      if (last?.type === 'thought') {
        streamBlocks[streamBlocks.length - 1] = { ...last, content: last.content + text }
      } else {
        streamBlocks.push({ id: nextBlockId('thought'), type: 'thought', content: text })
      }
      return {
        currentThought: s.currentThought + text,
        streamBlocks,
        pendingSuggestions: computePendingSuggestions(s.streaming, streamBlocks, s.messages)
      }
    }),
  appendText: (text) =>
    set((s) => {
      const streamBlocks = [...s.streamBlocks]
      const last = streamBlocks[streamBlocks.length - 1]
      if (last?.type === 'text') {
        streamBlocks[streamBlocks.length - 1] = { ...last, content: last.content + text }
      } else {
        streamBlocks.push({ id: nextBlockId('text'), type: 'text', content: text })
      }
      return {
        currentText: s.currentText + text,
        streamBlocks,
        pendingSuggestions: computePendingSuggestions(s.streaming, streamBlocks, s.messages)
      }
    }),
  resetStreamBuffers: () =>
    set({
      currentThought: '',
      currentText: '',
      activeTools: []
    }),
  clearStreamBlocks: () =>
    set((s) => ({
      streamBlocks: [],
      currentThought: '',
      currentText: '',
      activeTools: [],
      pendingSuggestions: computePendingSuggestions(s.streaming, [], s.messages)
    })),

  addToolCall: (tc) =>
    set((s) => {
      if (s.activeTools.some((t) => t.id === tc.id)) return s
      return {
        activeTools: [...s.activeTools, tc],
        streamBlocks: [...s.streamBlocks, { id: nextBlockId('tool'), type: 'tool', tool: tc }]
      }
    }),
  updateToolCall: (id, update) =>
    set((s) => {
      const streamBlocks = s.streamBlocks.map((b) =>
        b.type === 'tool' && b.tool.id === id ? { ...b, tool: { ...b.tool, ...update } } : b
      )
      const activeTools = s.activeTools
        .map((t) => (t.id === id ? { ...t, ...update } : t))
        .filter((t) => t.status === 'running')
      return { activeTools, streamBlocks }
    }),
  clearActiveTools: () => set({ activeTools: [] }),

  appendPlanBlock: (planId, title) =>
    set((s) => ({
      streamBlocks: [
        ...s.streamBlocks,
        { id: nextBlockId('plan'), type: 'plan' as const, planId, title }
      ]
    })),

  addSuggestion: (suggestion) =>
    set((s) => {
      const streamBlocks: AssistantBlock[] = [
        ...s.streamBlocks,
        {
          id: nextBlockId('sug'),
          type: 'suggestion',
          suggestion: { ...suggestion, status: 'pending' }
        }
      ]
      return {
        streamBlocks,
        pendingSuggestions: computePendingSuggestions(s.streaming, streamBlocks, s.messages)
      }
    }),
  setSuggestionStatus: (id, status) =>
    set((s) => {
      const streamBlocks = s.streamBlocks.map((b) =>
        b.type === 'suggestion' && b.suggestion.id === id
          ? { ...b, suggestion: { ...b.suggestion, status } }
          : b
      )
      return {
        streamBlocks,
        pendingSuggestions: computePendingSuggestions(s.streaming, streamBlocks, s.messages)
      }
    }),
  setSuggestionStatusInMessage: (messageId, suggestionId, status) =>
    set((s) => {
      const messages = s.messages.map((msg) => {
        if (msg.id !== messageId || !msg.blocks) return msg
        return {
          ...msg,
          blocks: msg.blocks.map((b) =>
            b.type === 'suggestion' && b.suggestion.id === suggestionId
              ? { ...b, suggestion: { ...b.suggestion, status } }
              : b
          )
        }
      })
      return {
        messages,
        pendingSuggestions: computePendingSuggestions(s.streaming, s.streamBlocks, messages)
      }
    }),
  markAllSuggestionsStatus: (status) =>
    set((s) => {
      const streamBlocks = s.streamBlocks.map((b) =>
        b.type === 'suggestion' && b.suggestion.status === 'pending'
          ? { ...b, suggestion: { ...b.suggestion, status } }
          : b
      )
      const messages = s.messages.map((msg) => {
        if (!msg.blocks?.length) return msg
        return {
          ...msg,
          blocks: msg.blocks.map((b) =>
            b.type === 'suggestion' && b.suggestion.status === 'pending'
              ? { ...b, suggestion: { ...b.suggestion, status } }
              : b
          )
        }
      })
      return {
        streamBlocks,
        messages,
        pendingSuggestions: computePendingSuggestions(s.streaming, streamBlocks, messages)
      }
    }),
  removeSuggestion: (id) =>
    set((s) => ({
      streamBlocks: s.streamBlocks.filter(
        (b) => !(b.type === 'suggestion' && b.suggestion.id === id)
      ),
      pendingSuggestions: s.pendingSuggestions.filter((p) => p.id !== id)
    })),
  clearSuggestions: () =>
    set((s) => ({
      pendingSuggestions: computePendingSuggestions(s.streaming, s.streamBlocks, s.messages)
    })),

  setRunStats: (runStats) =>
    set((s) => ({
      runStats: {
        ...runStats,
        startedAt: s.runStats.startedAt > 0 ? s.runStats.startedAt : runStats.startedAt
      }
    })),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setPendingContinue: (pendingContinue, pendingContinueSessionId = null, pendingContinueReason) =>
    set({ pendingContinue, pendingContinueSessionId, pendingContinueReason })
}))

export function blocksToLegacyContent(blocks: AssistantBlock[]): {
  content: string
  thoughts?: string
  toolCalls?: ToolCallEvent[]
} {
  const textParts: string[] = []
  const thoughtParts: string[] = []
  const toolCalls: ToolCallEvent[] = []

  for (const block of blocks) {
    if (block.type === 'text') textParts.push(block.content)
    if (block.type === 'thought') thoughtParts.push(block.content)
    if (block.type === 'tool') toolCalls.push(block.tool)
  }

  return {
    content: textParts.join('').trim(),
    thoughts: thoughtParts.join('').trim() || undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined
  }
}
