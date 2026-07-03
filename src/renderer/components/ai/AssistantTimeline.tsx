import type { AssistantBlock } from '../../ai/types'
import ThoughtStream from './ThoughtStream'
import ToolTimeline from './ToolTimeline'
import InlineDiffBlock from './InlineDiffBlock'
import MarkdownContent from './MarkdownContent'
import { useAiStore } from '../../store/aiStore'

interface Props {
  blocks: AssistantBlock[]
  streaming?: boolean
  onAcceptSuggestion?: (id: string) => void
  onRejectSuggestion?: (id: string) => void
}

export default function AssistantTimeline({
  blocks,
  streaming,
  onAcceptSuggestion,
  onRejectSuggestion
}: Props) {
  if (blocks.length === 0) return null

  return (
    <div className="py-1">
      {blocks.map((block, index) => {
        const isLast = index === blocks.length - 1

        if (block.type === 'thought') {
          return (
            <ThoughtStream
              key={block.id}
              thought={block.content}
              streaming={streaming && isLast}
              compact
            />
          )
        }

        if (block.type === 'text') {
          return (
            <MarkdownContent
              key={block.id}
              content={block.content}
              streaming={streaming && isLast}
              className="px-3 py-1"
            />
          )
        }

        if (block.type === 'tool') {
          return <ToolTimeline key={block.id} tools={[block.tool]} />
        }

        if (block.type === 'suggestion') {
          return (
            <InlineDiffBlock
              key={block.id}
              suggestion={block.suggestion}
              onAccept={onAcceptSuggestion}
              onReject={onRejectSuggestion}
            />
          )
        }

        if (block.type === 'plan') {
          return <PlanBlock key={block.id} planId={block.planId} title={block.title} />
        }

        return null
      })}
    </div>
  )
}

function PlanBlock({ planId, title }: { planId: string; title: string }) {
  const openPlanPanel = useAiStore((s) => s.openPlanPanel)

  return (
    <div className="mx-3 my-2 rounded-lg border border-word-accent/30 bg-word-accent/5 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-word-accent">
        <span>Implementation Plan</span>
      </div>
      <p className="mb-2 text-[13px] text-gray-700">{title}</p>
      <button
        type="button"
        onClick={() => openPlanPanel(planId)}
        className="rounded bg-word-accent px-3 py-1 text-[11px] font-medium text-white hover:bg-word-accent-hover"
      >
        View Plan
      </button>
    </div>
  )
}
