import type { AgentMode, ImplementationPlan } from './types'
import type { StreamFinishReason, StreamTurnMeta } from '../../shared/agentSession'
import { DEFAULT_AGENT_CONFIG } from '../../shared/agentConfig'

const PLANNING_PATTERNS = [
  /\bi will\b/i,
  /\bi'll\b/i,
  /\bnext i('ll| will)\b/i,
  /\blet me\b/i,
  /\bnow i('ll| will)\b/i,
  /\bgoing to\b/i,
  /\babout to\b/i
]

export interface TurnCompletionState {
  mode: AgentMode
  editToolCount: number
  nudgeCount: number
  originalUserIntent: string
  activePlan?: ImplementationPlan | null
  segmentSteps: number
}

export interface TurnCompletionInput {
  text: string
  functionCallCount: number
  meta: StreamTurnMeta
  submittedPlan: boolean
}

export type TurnCompletionDecision =
  | { action: 'stop' }
  | { action: 'continue'; message: string; reason: string }

function pendingPlanTodos(plan: ImplementationPlan | null | undefined): string[] {
  if (!plan?.todos?.length) return []
  return plan.todos.filter((t) => t.status !== 'done').map((t) => t.content)
}

function looksLikePlanningOnly(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  return PLANNING_PATTERNS.some((p) => p.test(trimmed))
}

function userAskedForEdits(intent: string): boolean {
  const lower = intent.toLowerCase()
  return (
    /\b(edit|rewrite|format|insert|delete|replace|fix|update|change|add|remove|implement)\b/.test(
      lower
    ) || /\bplan\b/.test(lower)
  )
}

export function buildContinuationMessage(
  reason: string,
  state: TurnCompletionState
): string {
  const pending = pendingPlanTodos(state.activePlan)
  if (pending.length > 0) {
    return `Continue executing the plan. Pending todos:\n${pending.map((t) => `- [ ] ${t}`).join('\n')}\n\nUse edit tools to complete the remaining work. Do not stop after planning text only.`
  }
  if (reason === 'length') {
    return 'Continue generating from where you were cut off. Pick up exactly where the previous response ended.'
  }
  if (reason === 'interrupted') {
    return 'The previous response was interrupted. Continue from where you left off and complete the task using tools.'
  }
  if (reason === 'segment_limit') {
    return `Reached the step limit for this segment (${state.segmentSteps} steps). Continue the task from where you left off. Use edit tools for any remaining document changes.`
  }
  if (state.editToolCount === 0 && userAskedForEdits(state.originalUserIntent)) {
    return 'You have not applied any document edits yet. Continue and use edit tools (replace_block, insert_block, format_text, etc.) to complete the requested changes.'
  }
  return 'Continue working on the task. Use edit tools to finish any remaining changes. Do not stop after planning-only text.'
}

export function evaluateTurnCompletion(
  input: TurnCompletionInput,
  state: TurnCompletionState
): TurnCompletionDecision {
  if (input.submittedPlan) return { action: 'stop' }
  if (input.functionCallCount > 0) return { action: 'stop' }

  if (input.meta.interrupted) {
    if (state.nudgeCount >= DEFAULT_AGENT_CONFIG.maxAgentNudges) {
      return { action: 'stop' }
    }
    return {
      action: 'continue',
      reason: 'interrupted',
      message: buildContinuationMessage('interrupted', state)
    }
  }

  if (input.meta.finishReason === 'length') {
    if (state.nudgeCount >= DEFAULT_AGENT_CONFIG.maxAgentNudges) {
      return { action: 'stop' }
    }
    return {
      action: 'continue',
      reason: 'length',
      message: buildContinuationMessage('length', state)
    }
  }

  if (state.mode === 'plan') {
    return { action: 'stop' }
  }

  const pending = pendingPlanTodos(state.activePlan)
  if (pending.length > 0) {
    if (state.nudgeCount >= DEFAULT_AGENT_CONFIG.maxAgentNudges) {
      return { action: 'stop' }
    }
    return {
      action: 'continue',
      reason: 'pending_todos',
      message: buildContinuationMessage('pending_todos', state)
    }
  }

  if (looksLikePlanningOnly(input.text)) {
    if (state.nudgeCount >= DEFAULT_AGENT_CONFIG.maxAgentNudges) {
      return { action: 'stop' }
    }
    return {
      action: 'continue',
      reason: 'planning_only',
      message: buildContinuationMessage('planning_only', state)
    }
  }

  if (state.editToolCount === 0 && userAskedForEdits(state.originalUserIntent)) {
    if (state.nudgeCount >= DEFAULT_AGENT_CONFIG.maxAgentNudges) {
      return { action: 'stop' }
    }
    return {
      action: 'continue',
      reason: 'no_edits',
      message: buildContinuationMessage('no_edits', state)
    }
  }

  return { action: 'stop' }
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
