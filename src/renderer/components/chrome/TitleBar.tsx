import type { RefObject } from 'react'
import type { WordCloneEditorRef } from '../../editor/editorBridge'
import { getDocumentTitle, useDocumentStore } from '../../store/documentStore'
import { Minus, Square, X } from 'lucide-react'

interface TitleBarProps {
  editorRef: RefObject<WordCloneEditorRef | null>
  onSave: (editorRef: RefObject<WordCloneEditorRef | null>) => Promise<boolean>
  onCloseRequest: () => void
}

export default function TitleBar({ editorRef, onSave, onCloseRequest }: TitleBarProps) {
  const displayName = useDocumentStore((s) => s.displayName)
  const isDirty = useDocumentStore((s) => s.isDirty)
  const title = getDocumentTitle({ displayName, isDirty })

  return (
    <div className="app-drag flex h-8 shrink-0 items-center justify-between bg-word-accent pl-3 pr-0 text-white">
      <span className="truncate text-[12px]">{title}</span>
      <div className="app-no-drag flex h-full">
        <button
          type="button"
          className="px-3 text-[12px] hover:bg-white/10"
          onClick={() => void onSave(editorRef)}
        >
          Save
        </button>
        <button type="button" className="flex w-11 items-center justify-center hover:bg-white/10" onClick={() => window.api.window.minimize()}>
          <Minus size={14} />
        </button>
        <button type="button" className="flex w-11 items-center justify-center hover:bg-white/10" onClick={() => window.api.window.toggleMaximize()}>
          <Square size={12} />
        </button>
        <button type="button" className="flex w-11 items-center justify-center hover:bg-red-600" onClick={onCloseRequest}>
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
