import { createContext, useContext, type RefObject } from 'react'
import type { SelectionState } from '@eigenpal/docx-editor-core/prosemirror'
import type { WordCloneEditorRef } from './editorBridge'

export interface EditorContextValue {
  editorRef: RefObject<WordCloneEditorRef | null>
  selection: SelectionState | null
  setSelection: (selection: SelectionState | null) => void
}

export const EditorContext = createContext<EditorContextValue | null>(null)

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) {
    throw new Error('useEditorContext must be used within EditorContext.Provider')
  }
  return ctx
}

export function useWordCloneEditor(): WordCloneEditorRef | null {
  return useEditorContext().editorRef.current
}
