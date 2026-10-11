import { useEffect, useState } from 'react'
import type { WordCloneEditorRef } from '../../editor/editorBridge'
import { AgentSessionClient } from '../../ai/sessionClient'
import { useAiStore } from '../../store/aiStore'
import type { AgentSessionSnapshot } from '../../../shared/agentSession'

interface Props {
  editor: WordCloneEditorRef | null
}

export default function SessionRecoveryBanner({ editor }: Props) {
  const [sessions, setSessions] = useState<AgentSessionSnapshot[]>([])
  const streaming = useAiStore((s) => s.streaming)

  useEffect(() => {
    void AgentSessionClient.listResumable().then(setSessions).catch(() => setSessions([]))
  }, [streaming])

  if (!editor || streaming || sessions.length === 0) return null

  const snap = sessions[0]

  return (
    <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
      <span className="truncate">
        Agent session can be resumed
        {snap.incompleteReason ? ` (${snap.incompleteReason.replace(/_/g, ' ')})` : ''}
      </span>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          className="rounded bg-word-accent px-2 py-0.5 text-white hover:opacity-90"
          onClick={() => void AgentSessionClient.resume(snap.sessionId, editor)}
        >
          Continue
        </button>
        <button
          type="button"
          className="rounded border border-amber-300 px-2 py-0.5 hover:bg-amber-100"
          onClick={() => setSessions([])}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
