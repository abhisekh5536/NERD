import { useState, useEffect } from 'react'
import { Brain, ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  thought: string
  streaming?: boolean
  compact?: boolean
}

export default function ThoughtStream({ thought, streaming, compact }: Props) {
  const [expanded, setExpanded] = useState(Boolean(streaming))

  useEffect(() => {
    if (streaming) setExpanded(true)
  }, [streaming])

  if (!thought) return null

  if (compact) {
    return (
      <div className="mx-3 my-1">
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] text-purple-600/80 hover:text-purple-700"
          onClick={() => setExpanded(!expanded)}
        >
          <Brain size={11} />
          {streaming ? 'Thinking…' : 'Thought briefly'}
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
        {expanded && (
          <div className="mt-1 rounded border border-purple-100 bg-purple-50/40 px-2 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap text-purple-900/75">
            {thought}
            {streaming && (
              <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-purple-400" />
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-3 my-1.5 rounded border border-purple-200 bg-purple-50/50">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[12px] font-medium text-purple-700"
        onClick={() => setExpanded(!expanded)}
      >
        <Brain size={13} />
        Thinking{streaming ? '...' : ''}
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {expanded && (
        <div className="border-t border-purple-200 px-2.5 py-2 text-[12px] leading-relaxed text-purple-900/80 whitespace-pre-wrap">
          {thought}
          {streaming && <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-purple-400" />}
        </div>
      )}
    </div>
  )
}
