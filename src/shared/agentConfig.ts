/** Agent harness limits and watchdog defaults (local durable execution). */
export const DEFAULT_AGENT_CONFIG = {
  maxSteps: 200,
  maxDurationMs: 2 * 60 * 60 * 1000,
  maxStepsPerSegment: 50,
  maxAgentNudges: 1,
  maxPlanNudges: 2,
  /** Max silence between streamed chunks after the first token arrives. */
  stallTimeoutMs: 30_000,
  /** Max wait for the provider to emit the first token (slow cold-start models). */
  firstTokenTimeoutMs: 120_000,
  maxTurnRetries: 5,
  maxStallRetries: 1,
  toolCallTimeoutMs: 60_000,
  historyMessageLimit: 12
} as const

export type AgentConfig = typeof DEFAULT_AGENT_CONFIG
