import { DEFAULT_AGENT_CONFIG } from '../../shared/agentConfig'

export interface StallWatchdogOptions {
  timeoutMs?: number
  onStall: () => void
}

/** Fires onStall when no markProgress() call occurs within timeoutMs. */
export class StallWatchdog {
  private lastProgressAt = Date.now()
  private timer: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  private readonly timeoutMs: number
  private readonly onStall: () => void

  constructor(options: StallWatchdogOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_AGENT_CONFIG.stallTimeoutMs
    this.onStall = options.onStall
    this.schedule()
  }

  markProgress(): void {
    if (this.disposed) return
    this.lastProgressAt = Date.now()
    this.schedule()
  }

  dispose(): void {
    this.disposed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private schedule(): void {
    if (this.disposed) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      if (this.disposed) return
      const elapsed = Date.now() - this.lastProgressAt
      if (elapsed >= this.timeoutMs) {
        this.onStall()
      } else {
        this.schedule()
      }
    }, this.timeoutMs)
  }
}
