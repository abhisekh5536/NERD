import { useEditorState, type Editor } from '@tiptap/react'
import { Redo2, Save, Undo2 } from 'lucide-react'

interface QuickAccessToolbarProps {
  editor: Editor | null
  onSave: (editor: Editor | null) => Promise<boolean>
}

export default function QuickAccessToolbar({ editor, onSave }: QuickAccessToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      canUndo: editor?.can().undo() ?? false,
      canRedo: editor?.can().redo() ?? false
    })
  })

  const btn =
    'app-no-drag flex h-6 w-6 items-center justify-center rounded-[3px] text-white/90 ' +
    'hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <div className="app-no-drag flex items-center gap-0.5">
      <button type="button" className={btn} title="Save" onClick={() => void onSave(editor)}>
        <Save size={15} strokeWidth={1.9} />
      </button>
      <button
        type="button"
        className={btn}
        title="Undo (Ctrl+Z)"
        disabled={!state?.canUndo}
        onClick={() => editor?.chain().focus().undo().run()}
      >
        <Undo2 size={15} strokeWidth={1.9} />
      </button>
      <button
        type="button"
        className={btn}
        title="Redo (Ctrl+Y)"
        disabled={!state?.canRedo}
        onClick={() => editor?.chain().focus().redo().run()}
      >
        <Redo2 size={15} strokeWidth={1.9} />
      </button>
    </div>
  )
}
