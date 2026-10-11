import type { WordCloneEditorRef } from '../editor/editorBridge'
import { getDocumentOutline, type OutlineEntry } from './docService'

export interface IndexedBlock {
  blockId: string
  type: string
  level?: number
  text: string
  pos: number
  charLength: number
}

export interface DocumentIndex {
  version: number
  docKey: string
  blocks: Map<string, IndexedBlock>
  blockOrder: string[]
  headings: OutlineEntry[]
  invertedIndex: Map<string, Set<string>>
  headingIndex: Map<string, Set<string>>
}

const TOKEN_MIN_LEN = 3

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length >= TOKEN_MIN_LEN)
}

function addToIndex(index: Map<string, Set<string>>, token: string, blockId: string): void {
  let set = index.get(token)
  if (!set) {
    set = new Set()
    index.set(token, set)
  }
  set.add(blockId)
}

function buildIndexFromEditor(editor: WordCloneEditorRef): DocumentIndex {
  const blocks = new Map<string, IndexedBlock>()
  const blockOrder: string[] = []
  const headings: OutlineEntry[] = []
  const invertedIndex = new Map<string, Set<string>>()
  const headingIndex = new Map<string, Set<string>>()

  const outline = getDocumentOutline(editor)
  outline.forEach((entry, index) => {
    blocks.set(entry.blockId, {
      blockId: entry.blockId,
      type: entry.type,
      level: entry.level,
      text: entry.text,
      pos: index,
      charLength: entry.text.length
    })
    blockOrder.push(entry.blockId)
    if (entry.type === 'heading') {
      headings.push(entry)
      for (const token of tokenize(entry.text)) {
        addToIndex(headingIndex, token, entry.blockId)
      }
    }
    for (const token of tokenize(entry.text)) {
      addToIndex(invertedIndex, token, entry.blockId)
    }
  })

  const docKey = `${blockOrder.length}:${editor.getTotalPages()}`

  return {
    version: 2,
    docKey,
    blocks,
    blockOrder,
    headings,
    invertedIndex,
    headingIndex
  }
}

let cachedIndex: DocumentIndex | null = null
let cachedDocKey: string | null = null

export function getDocumentIndex(editor: WordCloneEditorRef): DocumentIndex {
  const docKey = `${editor.getTotalPages()}:${getDocumentOutline(editor).length}`
  if (cachedIndex && cachedDocKey === docKey) {
    return cachedIndex
  }
  cachedIndex = buildIndexFromEditor(editor)
  cachedDocKey = docKey
  return cachedIndex
}

export function invalidateDocumentIndex(): void {
  cachedIndex = null
  cachedDocKey = null
}
