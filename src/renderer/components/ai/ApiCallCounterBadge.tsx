import { useAiStore } from '../../store/aiStore'

export default function ApiCallCounterBadge() {
  const streaming = useAiStore((s) => s.streaming)
  const stepCount = useAiStore((s) => s.runStats.stepCount)
  const editToolCount = useAiStore((s) => s.runStats.editToolCount)
  const nudgeCount = useAiStore((s) => s.runStats.nudgeCount)

  if (!streaming && stepCount === 0) return null

  const tooltipParts = [
    `${stepCount} LLM call${stepCount === 1 ? '' : 's'}`,
    `${editToolCount} edit tool${editToolCount === 1 ? '' : 's'}`,
    `${nudgeCount} auto-nudge${nudgeCount === 1 ? '' : 's'}`
  ]
  const title = tooltipParts.join(' · ')

  return (
    <div
      className="absolute right-3 top-11 z-20 flex items-center gap-1.5 rounded-md border border-ribbon-border bg-white/95 px-2.5 py-1 text-[11px] text-gray-600 shadow-lg backdrop-blur-sm"
      title={title}
    >
      {streaming && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-word-accent opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-word-accent" />
        </span>
      )}
      <span>
        API calls:{' '}
        <span
          className={`font-medium tabular-nums ${streaming ? 'text-word-accent' : 'text-gray-800'}`}
        >
          {stepCount}
        </span>
        {!streaming && nudgeCount > 0 && (
          <span className="ml-1 tabular-nums text-gray-400">({nudgeCount} nudges)</span>
        )}
      </span>
    </div>
  )
}
