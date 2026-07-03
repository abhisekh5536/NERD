import { useEffect, useState } from 'react'
import { useAiStore } from '../../store/aiStore'

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000)
  const min = Math.floor(sec / 60)
  const remSec = sec % 60
  if (min === 0) return `${sec}s`
  return `${min}m ${remSec}s`
}

export default function AgentRunStatusBar() {
  const streaming = useAiStore((s) => s.streaming)
  const runStats = useAiStore((s) => s.runStats)
  const [, tick] = useState(0)

  useEffect(() => {
    if (!streaming) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [streaming])

  if (!streaming) return null

  const elapsed =
    runStats.startedAt > 0 ? formatElapsed(Date.now() - runStats.startedAt) : '0s'
  const label = runStats.statusLabel ?? `Running · Step ${runStats.stepCount}`

  return (
    <div className="flex items-center justify-between border-t border-ribbon-border bg-chrome/80 px-3 py-1.5 text-[11px] text-gray-600">
      <span className="truncate">{label}</span>
      <span className="shrink-0 tabular-nums text-gray-400">
        {elapsed}
        {runStats.segmentIndex > 0 ? ` · Seg ${runStats.segmentIndex + 1}` : ''}
      </span>
    </div>
  )
}
