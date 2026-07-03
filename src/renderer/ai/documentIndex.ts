import type { Editor } from '@tiptap/core'
import type { OutlineEntry } from './docService'

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

const LIST_CONTAINER_TYPES = new Set(['bulletList', 'orderedList'])
const OUTLINE_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'table',
  'blockquote',
  'codeBlock',
  'image'
])
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

function buildIndexFromEditor(editor: Editor): DocumentIndex {
  const blocks = new Map<string, IndexedBlock>()
  const blockOrder: string[] = []
  const headings: OutlineEntry[] = []
  const invertedIndex = new Map<string, Set<string>>()
  const headingIndex = new Map<string, Set<string>>()

  editor.state.doc.descendants((node, pos) => {
    if (!node.attrs.blockId) return true
    if (LIST_CONTAINER_TYPES.has(node.type.name)) return true
    if (!OUTLINE_BLOCK_TYPES.has(node.type.name)) return true

    const blockId = node.attrs.blockId as string
    const type = node.type.name
    const text = node.textContent
    const charLength = text.length
    const level = type === 'heading' ? (node.attrs.level ?? 1) : undefined

    blocks.set(blockId, { blockId, type, level, text, pos, charLength })
    blockOrder.push(blockId)

    if (type === 'heading') {
      headings.push({ blockId, level: level!, text, type: 'heading' })
      for (const token of tokenize(text)) {
        addToIndex(headingIndex, token, blockId)
      }
    }

    for (const token of tokenize(text)) {
      addToIndex(invertedIndex, token, blockId)
    }

    return true
  })

  const doc = editor.state.doc
  const docKey = `${doc.content.size}:${doc.textContent.length}`

  return {
    version: 1,
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

export function getDocumentIndex(editor: Editor): DocumentIndex {
  const doc = editor.state.doc
  const docKey = `${doc.content.size}:${doc.textContent.length}`
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
