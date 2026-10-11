export type ChatRole = 'user' | 'assistant'

export type AgentMode = 'agent' | 'plan'

export type PlanStatus = 'draft' | 'building' | 'done'

export interface PlanTodo {
  id: string
  content: string
  status?: 'pending' | 'in_progress' | 'done'
}

export interface ImplementationPlan {
  id: string
  title: string
  overview?: string
  markdown: string
  todos?: PlanTodo[]
  status: PlanStatus
  sourceMessageId?: string
  createdAt: number
}

export interface ToolCallEvent {
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
  status: 'running' | 'done' | 'error'
}

/** Raw stream chunk as received from the LLM adapter. */
export interface RawLlmTurn {
  requestId?: string
  chunks: import('../../preload/index').AiChunk[]
  modelParts: Record<string, unknown>[]
  toolResults?: Array<{
    name: string
    id?: string
    args: Record<string, unknown>
    result: unknown
    status: 'done' | 'error'
  }>
}

/** Full raw LLM output including metadata (reasoning, tool calls, model parts). */
export interface RawLlmResponse {
  provider: string
  model: string
  thinkingEnabled: boolean
  temperature: number
  turns: RawLlmTurn[]
  content?: string
  reasoning_content?: string
  tool_calls?: ToolCallEvent[]
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  thoughts?: string
  toolCalls?: ToolCallEvent[]
  rawResponse?: RawLlmResponse
  suggestions?: string[]
  blocks?: AssistantBlock[]
  planId?: string
  timestamp: number
}

export type AgentEventType =
  | 'thought'
  | 'text'
  | 'tool-start'
  | 'tool-result'
  | 'suggestion'
  | 'done'
  | 'error'

export interface AgentEvent {
  type: AgentEventType
  text?: string
  toolCall?: ToolCallEvent
  suggestionId?: string
  error?: string
}

export interface PendingSuggestion {
  id: string
  blockId: string
  description: string
  originalHtml: string
  newHtml: string
  revisionId?: number
}

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected'

export type TimelineSuggestion = PendingSuggestion & { status: SuggestionStatus }

export type AssistantBlock =
  | { id: string; type: 'thought'; content: string }
  | { id: string; type: 'text'; content: string }
  | { id: string; type: 'tool'; tool: ToolCallEvent }
  | { id: string; type: 'suggestion'; suggestion: TimelineSuggestion }
  | { id: string; type: 'plan'; planId: string; title: string }

export function getPendingFromBlocks(blocks: AssistantBlock[]): PendingSuggestion[] {
  return blocks
    .filter((b): b is Extract<AssistantBlock, { type: 'suggestion' }> => b.type === 'suggestion')
    .filter((b) => b.suggestion.status === 'pending')
    .map((b) => ({
      id: b.suggestion.id,
      blockId: b.suggestion.blockId,
      description: b.suggestion.description,
      originalHtml: b.suggestion.originalHtml,
      newHtml: b.suggestion.newHtml
    }))
}
