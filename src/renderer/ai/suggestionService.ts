import type { WordCloneEditorRef } from '../editor/editorBridge'
import { findParagraphSnapshot } from '../editor/editorBridge'
import { blockTypeToStyleId, insertParagraphAfter } from '../editor/paragraphInsert'
import { useAiStore } from '../store/aiStore'
import { findParagraphText, getLatestRevisionId } from './docServiceHelpers'
import {
  acceptAllChanges,
  acceptChangeById,
  rejectAllChanges,
  rejectChangeById
} from '@eigenpal/docx-editor-core/prosemirror/commands'

const AI_AUTHOR = 'WordClone AI'

function runTrackedChangeCommand(
  editor: WordCloneEditorRef,
  command: ReturnType<typeof acceptChangeById>
): void {
  const paged = editor.getEditorRef()
  const view = paged?.getView()
  if (!view) return
  command(view.state, view.dispatch)
  try {
    paged?.relayout()
  } catch {
    /* layout will catch up on the next edit */
  }
}

function trackSuggestion(
  suggestionId: string,
  blockId: string,
  description: string,
  originalHtml: string,
  newHtml: string,
  revisionId?: number
): void {
  useAiStore.getState().addSuggestion({
    id: suggestionId,
    blockId,
    description,
    originalHtml,
    newHtml,
    revisionId
  })
}

function findMessageIdForSuggestion(suggestionId: string): string | null {
  const { streaming, messages } = useAiStore.getState()
  if (streaming) return null
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'assistant' || !msg.blocks) continue
    if (msg.blocks.some((b) => b.type === 'suggestion' && b.suggestion.id === suggestionId)) {
      return msg.id
    }
  }
  return null
}

function setSuggestionStatusEverywhere(suggestionId: string, status: 'accepted' | 'rejected'): void {
  const store = useAiStore.getState()
  if (store.streaming) {
    store.setSuggestionStatus(suggestionId, status)
    return
  }
  const messageId = findMessageIdForSuggestion(suggestionId)
  if (messageId) {
    store.setSuggestionStatusInMessage(messageId, suggestionId, status)
  } else {
    store.setSuggestionStatus(suggestionId, status)
  }
}

function newSuggestionId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function stageReplace(
  editor: WordCloneEditorRef,
  blockId: string,
  content: unknown,
  description: string
): { success: boolean; suggestionId?: string; description?: string; error?: string } {
  const originalText = findParagraphText(editor, blockId)
  if (originalText == null) return { success: false, error: `Block ${blockId} not found` }

  const newText = typeof content === 'string' ? content : String(content ?? '')
  const ok = editor.proposeChange({
    paraId: blockId,
    search: originalText,
    replaceWith: newText,
    author: AI_AUTHOR
  })
  if (!ok) return { success: false, error: 'Failed to stage replacement' }

  const suggestionId = newSuggestionId()
  const revisionId = getLatestRevisionId(editor)
  trackSuggestion(suggestionId, blockId, description, originalText, newText, revisionId)
  return { success: true, suggestionId, description }
}

export function stageInsert(
  editor: WordCloneEditorRef,
  afterBlockId: string,
  content: unknown,
  description: string,
  opts?: { blockType?: string }
): { success: boolean; suggestionId?: string; blockId?: string; description?: string; error?: string } {
  if (afterBlockId !== '__start__' && !findParagraphSnapshot(editor, afterBlockId)) {
    return { success: false, error: 'Insert anchor not found.' }
  }

  const newText = typeof content === 'string' ? content : String(content ?? '')
  const styleId = blockTypeToStyleId(opts?.blockType)
  const result = insertParagraphAfter(editor, {
    afterBlockId,
    text: newText,
    styleId,
    blockType: opts?.blockType,
    author: AI_AUTHOR
  })

  if (!result.success || !result.newParaId) {
    return { success: false, error: result.error ?? 'Failed to stage insert.' }
  }

  const suggestionId = newSuggestionId()
  trackSuggestion(
    suggestionId,
    result.newParaId,
    description,
    '',
    newText,
    result.revisionId
  )
  return { success: true, suggestionId, blockId: result.newParaId, description }
}

export function stageDelete(
  editor: WordCloneEditorRef,
  blockIds: string[],
  description: string
): { success: boolean; deleted: string[]; error?: string } {
  const deleted: string[] = []
  const notFound: string[] = []

  for (const blockId of blockIds) {
    const text = findParagraphText(editor, blockId)
    if (text == null) {
      notFound.push(blockId)
      continue
    }
    const ok = editor.proposeChange({
      paraId: blockId,
      search: text,
      replaceWith: '',
      author: AI_AUTHOR
    })
    if (!ok) {
      notFound.push(blockId)
      continue
    }
    const suggestionId = newSuggestionId()
    const revisionId = getLatestRevisionId(editor)
    trackSuggestion(suggestionId, blockId, description, text, '', revisionId)
    deleted.push(blockId)
  }

  if (deleted.length === 0) {
    return {
      success: false,
      deleted: [],
      error: `Not found or failed: ${notFound.join(', ')}`
    }
  }
  return { success: true, deleted }
}

export function stageFormatRange(
  editor: WordCloneEditorRef,
  blockId: string,
  from: number,
  to: number,
  description: string,
  opts?: { beforeContent?: unknown; type?: 'format' | 'style' }
): { success: boolean; suggestionId?: string } {
  void opts
  const text = findParagraphText(editor, blockId)
  if (text == null) return { success: false }
  const search = text.slice(from, to)
  editor.applyFormatting({ paraId: blockId, search, marks: { bold: true } })
  const suggestionId = newSuggestionId()
  trackSuggestion(suggestionId, blockId, description, text, text)
  return { success: true, suggestionId }
}

export function stageReplaceRange(
  editor: WordCloneEditorRef,
  blockId: string,
  from: number,
  to: number,
  newText: string,
  description: string
): { success: boolean; suggestionId?: string; error?: string } {
  const text = findParagraphText(editor, blockId)
  if (text == null) return { success: false, error: `Block ${blockId} not found` }
  const search = text.slice(from, to)
  const ok = editor.proposeChange({
    paraId: blockId,
    search,
    replaceWith: newText,
    author: AI_AUTHOR
  })
  if (!ok) return { success: false, error: 'Failed to stage partial replace' }
  const suggestionId = newSuggestionId()
  const revisionId = getLatestRevisionId(editor)
  trackSuggestion(suggestionId, blockId, description, search, newText, revisionId)
  return { success: true, suggestionId }
}

export function acceptSuggestion(editor: WordCloneEditorRef, id: string): void {
  const suggestion = useAiStore.getState().pendingSuggestions.find((s) => s.id === id)
  if (suggestion?.revisionId != null) {
    runTrackedChangeCommand(editor, acceptChangeById(suggestion.revisionId))
  } else {
    runTrackedChangeCommand(editor, acceptAllChanges())
  }
  setSuggestionStatusEverywhere(id, 'accepted')
}

export function rejectSuggestion(editor: WordCloneEditorRef, id: string): void {
  const suggestion = useAiStore.getState().pendingSuggestions.find((s) => s.id === id)
  if (suggestion?.revisionId != null) {
    runTrackedChangeCommand(editor, rejectChangeById(suggestion.revisionId))
  } else {
    runTrackedChangeCommand(editor, rejectAllChanges())
  }
  setSuggestionStatusEverywhere(id, 'rejected')
}

export function acceptAllSuggestions(editor: WordCloneEditorRef): void {
  runTrackedChangeCommand(editor, acceptAllChanges())
  useAiStore.getState().markAllSuggestionsStatus('accepted')
}

export function rejectAllSuggestions(editor: WordCloneEditorRef): void {
  runTrackedChangeCommand(editor, rejectAllChanges())
  useAiStore.getState().markAllSuggestionsStatus('rejected')
}
