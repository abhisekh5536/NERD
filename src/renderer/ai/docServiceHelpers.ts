import type { WordCloneEditorRef } from '../editor/editorBridge'
import { findParagraphSnapshot, collectParagraphSnapshots } from '../editor/editorBridge'
import { findParaIdRange, getVanillaNodeText } from '@eigenpal/docx-editor-core/prosemirror/paraText'
import { extractTrackedChanges } from '@eigenpal/docx-editor-core/prosemirror/utils/extractTrackedChanges'

export function findParagraphText(editor: WordCloneEditorRef, blockId: string): string | null {
  const doc = editor.getEditorRef()?.getState()?.doc ?? null
  if (doc) {
    const range = findParaIdRange(doc, blockId)
    if (range) {
      const node = doc.nodeAt(range.from)
      if (node) return getVanillaNodeText(node)
    }
  }
  return findParagraphSnapshot(editor, blockId)?.text ?? null
}

export function getLatestRevisionId(editor: WordCloneEditorRef): number | undefined {
  const state = editor.getEditorRef()?.getState() ?? null
  const { entries } = extractTrackedChanges(state)
  if (entries.length === 0) return undefined
  return entries[entries.length - 1]?.revisionId
}

export { collectParagraphSnapshots }
