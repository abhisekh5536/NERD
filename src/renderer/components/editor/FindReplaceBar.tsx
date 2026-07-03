import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

interface TextMatch {
  from: number
  to: number
}

function findTextMatches(editor: Editor, query: string): TextMatch[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const needle = trimmed.toLowerCase()
  const matches: TextMatch[] = []

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const haystack = node.text.toLowerCase()
    let idx = haystack.indexOf(needle)
    while (idx !== -1) {
      matches.push({
        from: pos + idx,
        to: pos + idx + trimmed.length
      })
      idx = haystack.indexOf(needle, idx + 1)
    }
  })

  return matches
}

interface FindReplaceBarProps {
  editor: Editor | null
}

export default function FindReplaceBar({ editor }: FindReplaceBarProps) {
  const mode = useUiStore((s) => s.findBarMode)
  const setMode = useUiStore((s) => s.setFindBarMode)
  const close = useUiStore((s) => s.closeFindBar)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!editor) return
    const onUpdate = () => setRevision((v) => v + 1)
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  }, [editor])

  const matches = useMemo(() => {
    void revision
    if (!editor) return []
    return findTextMatches(editor, findText)
  }, [editor, findText, revision])
  const currentIndex = matches.length === 0 ? 0 : Math.min(activeIndex, matches.length - 1)

  const focusMatch = useCallback(
    (index: number): void => {
      if (!editor || matches.length === 0) return
      const normalized = (index + matches.length) % matches.length
      const match = matches[normalized]
      if (!match) return
      editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run()
      setActiveIndex(normalized)
    },
    [editor, matches]
  )

  const replaceCurrent = useCallback(() => {
    if (!editor || matches.length === 0) return
    const current = matches[currentIndex]
    if (!current) return
    editor.chain().focus().insertContentAt({ from: current.from, to: current.to }, replaceText).run()
    setRevision((v) => v + 1)
  }, [editor, matches, currentIndex, replaceText])

  const replaceAll = useCallback(() => {
    if (!editor || matches.length === 0) return
    const ordered = [...matches].sort((a, b) => b.from - a.from)
    const chain = editor.chain().focus()
    for (const match of ordered) {
      chain.insertContentAt({ from: match.from, to: match.to }, replaceText)
    }
    chain.run()
    setRevision((v) => v + 1)
  }, [editor, matches, replaceText])

  return (
    <div className="find-replace-bar app-no-drag">
      <div className="find-replace-row">
        <div className="find-replace-input-wrap">
          <Search size={14} />
          <input
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            placeholder="Find"
            className="find-replace-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                focusMatch(e.shiftKey ? activeIndex - 1 : activeIndex + 1)
              } else if (e.key === 'Escape') {
                close()
              }
            }}
            autoFocus
          />
        </div>
        <span className="find-replace-count">
          {matches.length === 0 ? 'No matches' : `${currentIndex + 1} of ${matches.length}`}
        </span>
        <button type="button" className="find-replace-icon-btn" onClick={() => focusMatch(currentIndex - 1)} title="Previous match">
          <ArrowUp size={14} />
        </button>
        <button type="button" className="find-replace-icon-btn" onClick={() => focusMatch(currentIndex + 1)} title="Next match">
          <ArrowDown size={14} />
        </button>
        <button type="button" className="find-replace-close-btn" onClick={close} title="Close">
          <X size={14} />
        </button>
      </div>

      {mode === 'replace' && (
        <div className="find-replace-row">
          <input
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace with"
            className="find-replace-input find-replace-input--replace"
          />
          <button type="button" className="find-replace-action-btn" onClick={replaceCurrent}>
            Replace
          </button>
          <button type="button" className="find-replace-action-btn" onClick={replaceAll}>
            Replace All
          </button>
        </div>
      )}

      <div className="find-replace-mode-row">
        <button
          type="button"
          className={`find-replace-mode-btn ${mode === 'find' ? 'find-replace-mode-btn--active' : ''}`}
          onClick={() => setMode('find')}
        >
          Find
        </button>
        <button
          type="button"
          className={`find-replace-mode-btn ${mode === 'replace' ? 'find-replace-mode-btn--active' : ''}`}
          onClick={() => setMode('replace')}
        >
          Replace
        </button>
      </div>
    </div>
  )
}
