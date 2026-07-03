import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Copy, Minus, Square, X } from 'lucide-react'
import QuickAccessToolbar from './QuickAccessToolbar'
import { useDocumentStore, getDocumentTitle } from '../../store/documentStore'

interface TitleBarProps {
  editor: Editor | null
  onSave: (editor: Editor | null) => Promise<boolean>
  onCloseRequest: () => void
}

export default function TitleBar({ editor, onSave, onCloseRequest }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false)
  const displayName = useDocumentStore((s) => s.displayName)
  const isDirty = useDocumentStore((s) => s.isDirty)
  const titleText = getDocumentTitle({ displayName, isDirty })

  useEffect(() => {
    window.api?.window
      ?.isMaximized()
      .then(setMaximized)
      .catch(() => undefined)
    const unsubscribe = window.api?.window?.onMaximizedChange(setMaximized)
    return () => unsubscribe?.()
  }, [])

  const control =
    'app-no-drag flex h-8 w-12 items-center justify-center text-white/90 transition-colors hover:bg-white/20'

  return (
    <div className="app-drag relative flex h-8 items-center justify-between bg-word-accent pl-2 text-white">
      <QuickAccessToolbar editor={editor} onSave={onSave} />

      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[12px] text-white/95">
        {titleText}
      </div>

      <div className="flex items-stretch">
        <button
          type="button"
          className={control}
          title="Minimize"
          onClick={() => window.api?.window?.minimize()}
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          className={control}
          title={maximized ? 'Restore' : 'Maximize'}
          onClick={() => window.api?.window?.toggleMaximize()}
        >
          {maximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button
          type="button"
          className={`${control} hover:bg-red-600`}
          title="Close"
          onClick={onCloseRequest}
        >
          <X size={17} />
        </button>
      </div>
    </div>
  )
}
