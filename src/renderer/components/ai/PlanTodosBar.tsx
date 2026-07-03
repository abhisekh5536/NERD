import { useCallback, useState } from 'react'
import { ChevronDown, ChevronRight, Circle, CheckCircle2, Loader2 } from 'lucide-react'
import type { PlanStatus, PlanTodo } from '../../ai/types'

const STORAGE_KEY = 'ai-plan-todos-collapsed'

interface Props {
  todos: PlanTodo[]
  planTitle?: string
  planStatus?: PlanStatus
  compact?: boolean
  className?: string
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function TodoStatusIcon({ status }: { status?: PlanTodo['status'] }) {
  if (status === 'done') {
    return <CheckCircle2 size={12} className="shrink-0 text-green-600" />
  }
  if (status === 'in_progress') {
    return <Loader2 size={12} className="shrink-0 animate-spin text-word-accent" />
  }
  return <Circle size={12} className="shrink-0 text-gray-400" />
}

export default function PlanTodosBar({
  todos,
  planTitle,
  planStatus,
  compact = false,
  className = ''
}: Props) {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const doneCount = todos.filter((t) => t.status === 'done').length
  const inProgressCount = todos.filter((t) => t.status === 'in_progress').length

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  if (todos.length === 0) return null

  return (
    <div
      className={`border-b border-ribbon-border bg-chrome/60 ${className}`}
      data-plan-status={planStatus}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left hover:bg-black/3"
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight size={12} className="shrink-0 text-gray-500" />
        ) : (
          <ChevronDown size={12} className="shrink-0 text-gray-500" />
        )}
        <span className="text-[11px] font-medium text-gray-700">
          To-dos ({todos.length})
        </span>
        {(doneCount > 0 || inProgressCount > 0) && (
          <span className="text-[10px] text-gray-500">
            {doneCount}/{todos.length}
          </span>
        )}
        {planTitle && !compact && (
          <span className="ml-auto truncate text-[10px] text-gray-400">{planTitle}</span>
        )}
      </button>

      {!collapsed && (
        <ul
          className={`space-y-0.5 overflow-y-auto px-3 pb-2 ${
            compact ? 'max-h-20' : 'max-h-32'
          }`}
        >
          {todos.map((todo) => (
            <li
              key={todo.id}
              className="flex items-start gap-1.5 text-[11px] text-gray-600"
            >
              <TodoStatusIcon status={todo.status} />
              <span
                className={`min-w-0 flex-1 leading-snug ${
                  todo.status === 'done' ? 'text-gray-400 line-through' : ''
                }`}
              >
                {todo.content}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
