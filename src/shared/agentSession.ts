import type { AiProvider } from './models'

export type AgentMode = 'agent' | 'plan'

export type StreamFinishReason = 'stop' | 'length' | 'tool_calls' | 'error' | 'unknown'

export interface StreamTurnMeta {
  finishReason?: StreamFinishReason
  interrupted?: boolean
}

export type AgentSessionStatus =
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface AgentRunStats {
  stepCount: number
  segmentIndex: number
  startedAt: number
  editToolCount: number
  nudgeCount: number
  statusLabel?: string
}

export interface AgentSessionSnapshot {
  sessionId: string
  status: AgentSessionStatus
  mode: AgentMode
  userMessage: string
  provider: AiProvider
  model: string
  temperature: number
  thinkingEnabled: boolean
  stats: AgentRunStats
  contents: unknown[]
  pendingContinue?: boolean
  incompleteReason?: string
  createdAt: number
  updatedAt: number
}

export type AgentSessionEvent =
  | { type: 'session_started'; sessionId: string; mode: AgentMode; at: number }
  | { type: 'stats_updated'; sessionId: string; stats: AgentRunStats }
  | { type: 'turn_started'; sessionId: string; turnIndex: number; requestId: string; at: number }
  | { type: 'turn_restarted'; sessionId: string; turnIndex: number; reason: string; at: number }
  | { type: 'chunk'; sessionId: string; turnIndex: number; chunk: unknown; seq: number }
  | { type: 'tool_call'; sessionId: string; turnIndex: number; tool: unknown; at: number }
  | { type: 'tool_result'; sessionId: string; turnIndex: number; tool: unknown; at: number }
  | { type: 'turn_completed'; sessionId: string; turnIndex: number; at: number }
  | { type: 'turn_interrupted'; sessionId: string; turnIndex: number; reason: string; at: number }
  | { type: 'stall_detected'; sessionId: string; turnIndex: number; at: number }
  | { type: 'continuation_injected'; sessionId: string; reason: string; message: string; at: number }
  | { type: 'segment_continued'; sessionId: string; segmentIndex: number; at: number }
  | {
      type: 'session_completed' | 'session_failed' | 'session_paused' | 'session_cancelled'
      sessionId: string
      reason?: string
      at: number
    }

export interface AgentStartPayload {
  userMessage: string
  mode: AgentMode
  skipUserMessage?: boolean
  resumeSessionId?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string; thoughts?: string }>
  planId?: string
  documentBlockCount?: number
}

export interface AgentContextPayload {
  full: boolean
}

export interface AgentToolCallPayload {
  name: string
  args: Record<string, unknown>
  id?: string
}

export interface AgentToolResultPayload {
  name: string
  id?: string
  args: Record<string, unknown>
  result: Record<string, unknown>
  status: 'done' | 'error'
}
