import type { Editor } from '@tiptap/core'
import { useAiStore } from '../store/aiStore'
import {
  getBlockById,
  resolveInsertAnchor,
  serializeRangeToHtml,
  serializeBlockToHtml
} from './docService'

function trackSuggestion(
  suggestionId: string,
  blockId: string,
  description: string,
  originalHtml: string,
  newHtml: string
): void {
  useAiStore.getState().addSuggestion({
    id: suggestionId,
    blockId,
    description,
    originalHtml,
    newHtml
  })
}

function latestSuggestionId(editor: Editor): string | null {
  const storage = editor.storage.suggestions as { lastCreatedId: string | null }
  return storage?.lastCreatedId ?? null
}

function latestInsertedBlockId(editor: Editor): string | null {
  const storage = editor.storage.suggestions as { lastCreatedInsertedBlockId: string | null }
  return storage?.lastCreatedInsertedBlockId ?? null
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

export function stageReplace(
  editor: Editor,
  blockId: string,
  content: any,
  description: string
): { success: boolean; suggestionId?: string; description?: string; error?: string } {
  const found = getBlockById(editor, blockId)
  if (!found) return { success: false, error: `Block ${blockId} not found` }

  const originalHtml = serializeBlockToHtml(editor, found.node, found.pos)
  const ok = editor.commands.stageSuggestionReplace({ blockId, content, description })
  if (!ok) return { success: false, error: 'Failed to stage replacement' }

  const suggestionId = latestSuggestionId(editor)
  if (suggestionId) {
    let newHtml = ''
    try {
      const rec = editor.storage.suggestions.suggestions.get(suggestionId)
      if (rec) {
        newHtml = serializeRangeToHtml(editor, rec.from, rec.to)
      }
    } catch {
      newHtml = String(content)
    }
    trackSuggestion(suggestionId, blockId, description, originalHtml, newHtml)
  }
  return { success: true, suggestionId: suggestionId ?? undefined, description }
}

export function stageInsert(
  editor: Editor,
  afterBlockId: string,
  content: any,
  description: string
): { success: boolean; suggestionId?: string; blockId?: string; description?: string; error?: string } {
  const anchor = resolveInsertAnchor(editor, afterBlockId)
  if ('error' in anchor) {
    return { success: false, error: anchor.error }
  }

  const ok = editor.commands.stageSuggestionInsert({ afterBlockId, content, description })
  if (!ok) {
    return {
      success: false,
      error: 'Failed to stage insert (editor rejected content). Check block type and plain text only.'
    }
  }

  const suggestionId = latestSuggestionId(editor)
  const blockId = latestInsertedBlockId(editor) ?? undefined
  if (suggestionId) {
    let newHtml = ''
    try {
      const rec = editor.storage.suggestions.suggestions.get(suggestionId)
      if (rec) {
        newHtml = serializeRangeToHtml(editor, rec.from, rec.to)
      }
    } catch {
      newHtml = String(content)
    }
    trackSuggestion(suggestionId, blockId ?? afterBlockId, description, '', newHtml)
  }
  return { success: true, suggestionId: suggestionId ?? undefined, blockId, description }
}

export function stageDelete(
  editor: Editor,
  blockIds: string[],
  description: string
): { success: boolean; deleted: string[]; error?: string } {
  const deleted: string[] = []
  const notFound: string[] = []

  for (const blockId of blockIds) {
    const found = getBlockById(editor, blockId)
    if (!found) {
      notFound.push(blockId)
      continue
    }

    const originalHtml = serializeBlockToHtml(editor, found.node, found.pos)
    const ok = editor.commands.stageSuggestionDelete({ blockId, description })
    if (!ok) {
      notFound.push(blockId)
      continue
    }

    const suggestionId = latestSuggestionId(editor)
    if (suggestionId) {
      trackSuggestion(suggestionId, blockId, description, originalHtml, '')
    }
    deleted.push(blockId)
  }

  if (deleted.length === 0) {
    const parts: string[] = []
    if (notFound.length > 0) {
      parts.push(`Not found or failed: ${notFound.join(', ')}`)
    }
    return {
      success: false,
      deleted: [],
      error: `${parts.join('. ')}. Use get_document_outline to find valid blockIds.`
    }
  }

  return { success: true, deleted }
}

export function stageFormatRange(
  editor: Editor,
  blockId: string,
  from: number,
  to: number,
  description: string,
  opts?: { beforeContent?: unknown; type?: 'format' | 'style' }
): { success: boolean; suggestionId?: string } {
  editor.commands.stageSuggestionRange({
    blockId,
    from,
    to,
    description,
    type: opts?.type ?? 'format',
    beforeContent: opts?.beforeContent
  })
  const suggestionId = latestSuggestionId(editor)
  if (suggestionId) {
    const found = getBlockById(editor, blockId)
    const originalHtml = found ? serializeBlockToHtml(editor, found.node, found.pos) : ''
    trackSuggestion(suggestionId, blockId, description, originalHtml, originalHtml)
  }
  return { success: true, suggestionId: suggestionId ?? undefined }
}

export function stageReplaceRange(
  editor: Editor,
  blockId: string,
  from: number,
  to: number,
  newText: string,
  description: string
): { success: boolean; suggestionId?: string; error?: string } {
  const ok = editor.commands.stageSuggestionReplaceRange({
    blockId,
    from,
    to,
    newText,
    description
  })
  if (!ok) return { success: false, error: 'Failed to stage partial replace' }

  const suggestionId = latestSuggestionId(editor)
  if (suggestionId) {
    const found = getBlockById(editor, blockId)
    const originalHtml = found ? serializeBlockToHtml(editor, found.node, found.pos) : ''
    trackSuggestion(suggestionId, blockId, description, originalHtml, originalHtml)
  }
  return { success: true, suggestionId: suggestionId ?? undefined }
}

export function acceptSuggestion(editor: Editor, id: string): void {
  editor.commands.acceptSuggestion(id)
  setSuggestionStatusEverywhere(id, 'accepted')
}

export function rejectSuggestion(editor: Editor, id: string): void {
  editor.commands.rejectSuggestion(id)
  setSuggestionStatusEverywhere(id, 'rejected')
}

export function acceptAllSuggestions(editor: Editor): void {
  editor.commands.acceptAllSuggestions()
  useAiStore.getState().markAllSuggestionsStatus('accepted')
}

export function rejectAllSuggestions(editor: Editor): void {
  editor.commands.rejectAllSuggestions()
  useAiStore.getState().markAllSuggestionsStatus('rejected')
}
