import { useState } from 'react'
import type { WordCloneEditorRef } from '../../editor/editorBridge'
import { useUiStore } from '../../store/uiStore'

export default function FindReplaceBar({ editor }: { editor: WordCloneEditorRef | null }) {
  const closeFindBar = useUiStore((s) => s.closeFindBar)
  const [query, setQuery] = useState('')
  const [replaceWith, setReplaceWith] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const handleFind = () => {
    if (!editor || !query.trim()) return
    const hits = editor.findInDocument(query.trim())
    if (hits.length === 0) {
      setStatus('No matches found.')
      return
    }
    editor.scrollToParaId(hits[0].paraId, { highlight: { durationMs: 1200 } })
    setStatus(`Found ${hits.length} match${hits.length === 1 ? '' : 'es'}.`)
  }

  const handleReplace = () => {
    if (!editor || !query.trim()) return
    const info = editor.getSelectionInfo()
    if (!info?.paraId) {
      setStatus('Select text or run Find first.')
      return
    }
    const ok = editor.proposeChange({
      paraId: info.paraId,
      search: query,
      replaceWith,
      author: 'WordClone User'
    })
    setStatus(ok ? 'Replacement suggested as track change.' : 'Replace failed.')
  }

  return (
    <div className="absolute left-4 top-4 z-30 w-[360px] rounded border border-ribbon-border bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-[13px]">Find</strong>
        <button type="button" className="text-[12px] text-gray-500 hover:text-gray-800" onClick={closeFindBar}>
          Close
        </button>
      </div>
      <input
        className="mb-2 w-full rounded border px-2 py-1 text-[13px]"
        placeholder="Find"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleFind()}
      />
      <input
        className="mb-2 w-full rounded border px-2 py-1 text-[13px]"
        placeholder="Replace with"
        value={replaceWith}
        onChange={(e) => setReplaceWith(e.target.value)}
      />
      <div className="flex gap-2">
        <button type="button" className="rounded bg-word-accent px-3 py-1 text-[12px] text-white" onClick={handleFind}>
          Find Next
        </button>
        <button type="button" className="rounded border px-3 py-1 text-[12px]" onClick={handleReplace}>
          Replace
        </button>
      </div>
      {status && <p className="mt-2 text-[12px] text-gray-600">{status}</p>}
    </div>
  )
}
