import type { WordCloneEditorRef } from '../editor/editorBridge'
import { getPageCount } from '../editor/editorBridge'
import {
  AGENT_SYSTEM_PROMPT,
  AGENT_PLAN_SYSTEM_PROMPT
} from '../../shared/agentPrompts'
import {
  buildDocumentOutlineView,
  readSelection
} from './docService'

export function buildSystemPrompt(): string {
  return AGENT_SYSTEM_PROMPT
}

export function buildPlanSystemPrompt(): string {
  return AGENT_PLAN_SYSTEM_PROMPT
}

function getPageCountForPrompt(editor: WordCloneEditorRef): number {
  return getPageCount(editor)
}

export interface ContextMessageOptions {
  /** When false, inject a lightweight stats-only context instead of repeating the fingerprint. */
  full?: boolean
}

export function buildContextMessages(
  editor: WordCloneEditorRef,
  options: ContextMessageOptions = { full: true }
): { role: string; parts: { text: string }[] }[] {
  const outlineView = buildDocumentOutlineView(editor)
  const selection = readSelection(editor)
  const pageCount = getPageCountForPrompt(editor)
  const full = options.full !== false

  let contextText = `## Current Document
Title: ${outlineView.title}
Words: ${outlineView.wordCount} | Blocks: ${outlineView.blockCount} | Pages: ~${pageCount}
Explore this document with tools. Do not assume content — locate first, then read.`

  if (!full) {
    contextText +=
      '\n\n(Document unchanged since last turn. Stats only. Call get_table_of_contents, search_document, or read_blocks as needed.)'
  }

  if (selection) {
    const preview =
      selection.text.slice(0, 200) + (selection.text.length > 200 ? '…' : '')
    contextText += `\n\n### Selection Active
Block IDs: ${selection.blockIds.join(', ')}
Preview: "${preview}"
Use read_selection for full selected text with formatting.`
  }

  return [
    { role: 'user', parts: [{ text: contextText }] },
    {
      role: 'model',
      parts: [
        {
          text: 'I see the document stats. I will use tools to locate and read content as needed. How can I help?'
        }
      ]
    }
  ]
}
