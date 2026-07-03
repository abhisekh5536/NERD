import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AgentSessionEvent, AgentSessionSnapshot } from '../../shared/agentSession'

export class AgentEventLog {
  private readonly dir: string
  private readonly eventsPath: string
  private readonly snapshotPath: string

  constructor(baseDir: string, sessionId: string) {
    this.dir = join(baseDir, sessionId)
    this.eventsPath = join(this.dir, 'events.jsonl')
    this.snapshotPath = join(this.dir, 'snapshot.json')
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true })
    }
  }

  append(event: AgentSessionEvent): void {
    appendFileSync(this.eventsPath, `${JSON.stringify(event)}\n`, 'utf-8')
  }

  saveSnapshot(snapshot: AgentSessionSnapshot): void {
    writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8')
  }

  loadSnapshot(): AgentSessionSnapshot | null {
    if (!existsSync(this.snapshotPath)) return null
    try {
      return JSON.parse(readFileSync(this.snapshotPath, 'utf-8')) as AgentSessionSnapshot
    } catch {
      return null
    }
  }

  static listResumable(baseDir: string): AgentSessionSnapshot[] {
    if (!existsSync(baseDir)) return []
    const sessions: AgentSessionSnapshot[] = []
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const log = new AgentEventLog(baseDir, entry.name)
      const snap = log.loadSnapshot()
      if (snap && (snap.status === 'running' || snap.status === 'paused')) {
        sessions.push(snap)
      }
    }
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
  }
}

export function getAgentSessionsDir(userDataPath: string): string {
  return join(userDataPath, 'agent-sessions')
}
