import { useEffect, useState } from 'react'
import type { WordCloneEditorRef } from '../../editor/editorBridge'
import { getPlainText } from '../../editor/editorBridge'
import { Minus, Plus } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

interface DocStats {
  words: number
  characters: number
}

function useDocStats(editor: WordCloneEditorRef | null): DocStats {
  const [stats, setStats] = useState<DocStats>({ words: 0, characters: 0 })

  useEffect(() => {
    if (!editor) return
    let raf = 0
    const update = (): void => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        try {
          const text = getPlainText(editor)
          const trimmed = text.trim()
          setStats({
            words: trimmed ? trimmed.split(/\s+/).length : 0,
            characters: text.length
          })
        } catch {
          /* ignore transient layout errors during bulk track-change ops */
        }
      })
    }
    update()
    return editor.onContentChange(() => update())
  }, [editor])

  return stats
}

export default function StatusBar({
  editor,
  pageCount
}: {
  editor: WordCloneEditorRef | null
  pageCount: number
}) {
  const { words, characters } = useDocStats(editor)
  const zoom = useUiStore((s) => s.zoom)
  const setZoom = useUiStore((s) => s.setZoom)
  const zoomIn = useUiStore((s) => s.zoomIn)
  const zoomOut = useUiStore((s) => s.zoomOut)
  const resetZoom = useUiStore((s) => s.resetZoom)
  const currentPage = editor?.getCurrentPage() ?? 1

  const zoomBtn = 'flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/20'

  return (
    <div className="flex h-6 shrink-0 items-center justify-between bg-word-accent px-3 text-[12px] text-white">
      <div className="flex items-center gap-4">
        <span>
          Page {currentPage} of {pageCount}
        </span>
        <span>
          {words} {words === 1 ? 'word' : 'words'}
        </span>
        <span className="text-white/70">{characters} characters</span>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className="tabular-nums hover:underline" title="Reset to 100%" onClick={resetZoom}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className={zoomBtn} title="Zoom Out" onClick={zoomOut}>
          <Minus size={13} />
        </button>
        <input
          type="range"
          min={10}
          max={500}
          step={10}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
          className="h-1 w-32 cursor-pointer accent-white"
          title="Zoom"
        />
        <button type="button" className={zoomBtn} title="Zoom In" onClick={zoomIn}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}
