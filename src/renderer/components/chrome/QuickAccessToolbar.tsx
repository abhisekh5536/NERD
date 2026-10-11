import type { RefObject } from 'react'
import type { WordCloneEditorRef } from '../../editor/editorBridge'
import { redo, undo } from '../../editor/editorBridge'
import { Redo2, Save, Undo2, FilePlus, Printer } from 'lucide-react'
import { createNewDocument, printDocument } from '../../services/documentService'

interface QuickAccessToolbarProps {
  editorRef: RefObject<WordCloneEditorRef | null>
  onSave: (editorRef: RefObject<WordCloneEditorRef | null>) => Promise<boolean>
}

export default function QuickAccessToolbar({ editorRef, onSave }: QuickAccessToolbarProps) {
  const btn =
    'app-no-drag flex h-6 w-6 items-center justify-center rounded-[3px] text-white/90 ' +
    'hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <div className="app-no-drag flex items-center gap-0.5">
      <button type="button" className={btn} title="New Document" onClick={() => void createNewDocument(editorRef)}>
        <FilePlus size={15} strokeWidth={1.9} />
      </button>
      <button type="button" className={btn} title="Save (Ctrl+S)" onClick={() => void onSave(editorRef)}>
        <Save size={15} strokeWidth={1.9} />
      </button>
      <button
        type="button"
        className={btn}
        title="Undo (Ctrl+Z)"
        onClick={() => undo(editorRef.current)}
      >
        <Undo2 size={15} strokeWidth={1.9} />
      </button>
      <button
        type="button"
        className={btn}
        title="Redo (Ctrl+Y)"
        onClick={() => redo(editorRef.current)}
      >
        <Redo2 size={15} strokeWidth={1.9} />
      </button>
      <button
        type="button"
        className={btn}
        title="Quick Print"
        onClick={() => void printDocument(editorRef)}
      >
        <Printer size={15} strokeWidth={1.9} />
      </button>
    </div>
  )
}
