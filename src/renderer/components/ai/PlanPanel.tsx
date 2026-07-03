import { useCallback } from 'react'
import { X, Hammer, FileText } from 'lucide-react'
import type { Editor } from '@tiptap/core'
import { useAiStore } from '../../store/aiStore'
import { AgentController } from '../../ai/agent'
import PlanTodosBar from './PlanTodosBar'

interface Props {
  editor: Editor | null
  onImplementPlan?: (planId: string) => void
}

export default function PlanPanel({ editor, onImplementPlan }: Props) {
  const planPanelOpen = useAiStore((s) => s.planPanelOpen)
  const activePlan = useAiStore((s) => s.activePlan)
  const streaming = useAiStore((s) => s.streaming)
  const updatePlanMarkdown = useAiStore((s) => s.updatePlanMarkdown)
  const setPlanPanelOpen = useAiStore((s) => s.setPlanPanelOpen)

  const handleImplement = useCallback(() => {
    if (!activePlan || streaming) return
    if (onImplementPlan) {
      onImplementPlan(activePlan.id)
      return
    }
    if (!editor) return
    const agent = new AgentController(editor)
    agent.runFromPlan(activePlan).catch((err) => {
      const store = useAiStore.getState()
      store.setStreaming(false)
      if (err instanceof Error && !err.message.includes('cancelled')) {
        store.addMessage({
          id: `msg_err_${Date.now()}`,
          role: 'assistant',
          content: `Error implementing plan: ${err.message}`,
          timestamp: Date.now()
        })
      }
    })
  }, [editor, activePlan, streaming, onImplementPlan])

  if (!planPanelOpen || !activePlan) return null

  const isBuilding = activePlan.status === 'building'

  return (
    <div
      className="flex h-full w-[400px] min-w-[320px] shrink-0 flex-col border-r border-ribbon-border bg-white"
      style={{ width: 400 }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-ribbon-border bg-chrome px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <FileText size={15} className="shrink-0 text-word-accent" />
          <span className="truncate text-[13px] font-semibold">{activePlan.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleImplement}
            disabled={streaming || isBuilding}
            className="flex items-center gap-1 rounded bg-word-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-word-accent-hover disabled:opacity-40"
            title="Implement this plan"
          >
            <Hammer size={12} />
            {isBuilding ? 'Building…' : 'Implement'}
          </button>
          <button
            type="button"
            onClick={() => setPlanPanelOpen(false)}
            className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600"
            title="Close plan panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {activePlan.overview && (
        <div className="border-b border-ribbon-border bg-chrome/40 px-3 py-2 text-[12px] text-gray-600">
          {activePlan.overview}
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden p-2">
        <textarea
          className="h-full w-full flex-1 resize-none rounded border border-ribbon-border px-3 py-2 font-mono text-[12px] leading-relaxed outline-none focus:border-word-accent"
          value={activePlan.markdown}
          onChange={(e) => updatePlanMarkdown(e.target.value)}
          spellCheck={false}
          disabled={isBuilding}
          placeholder="Plan markdown…"
        />
      </div>

      {activePlan.todos && activePlan.todos.length > 0 && (
        <PlanTodosBar
          todos={activePlan.todos}
          planStatus={activePlan.status}
          compact
        />
      )}
    </div>
  )
}
