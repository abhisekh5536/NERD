import type { Editor } from '@tiptap/core'
import { DOMSerializer } from '@tiptap/pm/model'
import type { Node as PmNode, Fragment } from '@tiptap/pm/model'
import { getDocumentIndex } from './documentIndex'
import {
  type BlockStyle,
  type FormattedRun,
  extractBlockStyleFromNode,
  serializeBlockRuns,
  serializeRangeRuns,
  serializeTableRowsFormatted,
  truncateRuns
} from './formatSerializer'

export type { BlockStyle, FormattedRun, InlineMarks } from './formatSerializer'
export type { FormattedCell } from './formatSerializer'

export interface OutlineEntry {
  blockId: string
  level: number
  text: string
  type: string
}

export interface DocumentOutlineView {
  title: string
  wordCount: number
  blockCount: number
  entries: OutlineEntry[]
  truncated: boolean
  totalEntries: number
  hint?: string
}

export interface ReadBlockEntry {
  blockId: string
  type: string
  text: string
  runs?: FormattedRun[]
  blockStyle?: BlockStyle
  rows?: Array<Array<{ text: string; runs?: FormattedRun[] }>>
  attrs?: Record<string, unknown>
  truncated?: boolean
  totalChars?: number
  /** Total character length of block flat text (same as totalChars when present). */
  charLength?: number
  prevBlockId?: string | null
  nextBlockId?: string | null
}

export interface ReadBlocksResult {
  blocks: ReadBlockEntry[]
  notFound: string[]
  truncated: boolean
  hint?: string
}

export interface SelectionReadResult {
  text: string
  runs: FormattedRun[]
  blockIds: string[]
  blockStyle?: BlockStyle
}

export interface SearchMatch {
  refId: string
  blockId: string
  type: string
  snippet: string
  matchIndex: number
  query?: string
}

export interface SearchDocumentOptions {
  query?: string
  queries?: string[]
  caseSensitive?: boolean
  maxResults?: number
  offset?: number
  scope?: 'all' | 'headings' | 'body'
  blockTypes?: string[]
}

export interface TableOfContentsResult {
  title: string
  headingCount: number
  headings: Array<{ blockId: string; level: number; text: string }>
}

export interface ReadSectionResult {
  startBlockId: string
  endBlockId: string | null
  blocks: ReadBlockEntry[]
  truncated: boolean
  totalBlocksInSection: number
  hint?: string
}

export interface SearchDocumentResult {
  matches: SearchMatch[]
  totalMatches: number
  offset: number
  hasMore: boolean
  hint?: string
}

/** @deprecated Use buildDocumentOutlineView for filtered outlines. */
export interface BlockData {
  blockId: string
  type: string
  textContent: string
  attrs: Record<string, unknown>
}

/** @deprecated Use SearchDocumentResult. */
export interface SearchResult {
  blockId: string
  type: string
  snippet: string
}

export const MAX_OUTLINE_ENTRIES = 200
export const HEADINGS_ONLY_THRESHOLD = 500
export const BODY_PREVIEW_LIMIT = 50
export const MAX_BLOCKS_PER_READ = 10
export const MAX_CHARS_PER_BLOCK = 4000
export const DEFAULT_SEARCH_PAGE_SIZE = 20
export const MAX_SEARCH_QUERIES = 5
export const MAX_SECTION_BLOCKS = 25
export const DEFAULT_SECTION_BLOCKS = 15

const OUTLINE_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'table',
  'blockquote',
  'codeBlock',
  'image'
])

const LIST_CONTAINER_TYPES = new Set(['bulletList', 'orderedList'])

function pickSemanticAttrs(type: string, attrs: Record<string, unknown>): Record<string, unknown> | undefined {
  const picked: Record<string, unknown> = {}
  if (type === 'image' && attrs.src) picked.src = attrs.src
  if (type === 'image' && attrs.alt) picked.alt = attrs.alt
  return Object.keys(picked).length > 0 ? picked : undefined
}

function buildSnippet(text: string, matchStart: number, matchLen: number): string {
  const start = Math.max(0, matchStart - 40)
  const end = Math.min(text.length, matchStart + matchLen + 40)
  return (
    (start > 0 ? '...' : '') +
    text.slice(start, end) +
    (end < text.length ? '...' : '')
  )
}

function collectRawOutlineEntries(editor: Editor): OutlineEntry[] {
  const outline: OutlineEntry[] = []
  editor.state.doc.descendants((node) => {
    if (!node.attrs.blockId) return
    if (LIST_CONTAINER_TYPES.has(node.type.name)) return

    if (node.type.name === 'heading') {
      outline.push({
        blockId: node.attrs.blockId,
        level: node.attrs.level ?? 1,
        text: node.textContent,
        type: 'heading'
      })
    } else if (OUTLINE_BLOCK_TYPES.has(node.type.name)) {
      const preview = node.textContent.slice(0, 80)
      const prefix = node.type.name === 'listItem' ? '- ' : ''
      outline.push({
        blockId: node.attrs.blockId,
        level: 0,
        text: prefix + preview + (node.textContent.length > 80 ? '...' : ''),
        type: node.type.name
      })
    }
  })
  return outline
}

export function serializeFragmentToHtml(editor: Editor, fragment: Fragment): string {
  const serializer = DOMSerializer.fromSchema(editor.schema)
  const dom = serializer.serializeFragment(fragment)
  const div = document.createElement('div')
  div.appendChild(dom)
  return div.innerHTML
}

export function serializeBlockToHtml(editor: Editor, node: PmNode, pos: number): string {
  const slice = editor.state.doc.slice(pos, pos + node.nodeSize)
  return serializeFragmentToHtml(editor, slice.content)
}

export function serializeRangeToHtml(editor: Editor, from: number, to: number): string {
  const slice = editor.state.doc.slice(from, to)
  return serializeFragmentToHtml(editor, slice.content)
}

/** Raw unfiltered outline — prefer buildDocumentOutlineView for agent use. */
export function getDocumentOutline(editor: Editor): OutlineEntry[] {
  return collectRawOutlineEntries(editor)
}

export function buildDocumentOutlineView(editor: Editor): DocumentOutlineView {
  const title = getDocumentTitle(editor)
  const stats = getDocumentStats(editor)
  const raw = collectRawOutlineEntries(editor)

  const headingsOnly = stats.blockCount > HEADINGS_ONLY_THRESHOLD
  let bodyPreviewCount = 0
  const entries: OutlineEntry[] = []

  for (const e of raw) {
    if (entries.length >= MAX_OUTLINE_ENTRIES) break

    if (headingsOnly && e.type !== 'heading') {
      if (bodyPreviewCount >= BODY_PREVIEW_LIMIT) continue
      bodyPreviewCount++
    }

    entries.push(e)
  }

  const truncated = raw.length > entries.length
  const hints: string[] = []
  if (truncated) {
    hints.push(`Showing ${entries.length} of ${raw.length} blocks. Use search_document to find specific content.`)
  }
  if (headingsOnly) {
    hints.push(`Large document: outline shows headings plus the first ${BODY_PREVIEW_LIMIT} body blocks. Use read_blocks for full content.`)
  }

  return {
    title,
    wordCount: stats.wordCount,
    blockCount: stats.blockCount,
    entries,
    truncated,
    totalEntries: raw.length,
    hint: hints.length > 0 ? hints.join(' ') : undefined
  }
}

export function formatOutlineEntries(entries: OutlineEntry[]): string {
  return entries
    .map((e) => {
      const indent = e.level > 0 ? '  '.repeat(e.level - 1) : ''
      const prefix = e.type === 'heading' ? `H${e.level}:` : `[${e.type}]`
      return `${indent}${prefix} (${e.blockId}) ${e.text}`
    })
    .join('\n')
}

export function getDocumentTitle(editor: Editor): string {
  let title = 'Untitled'
  editor.state.doc.descendants((node): boolean => {
    if (node.type.name === 'heading' && node.attrs.level === 1) {
      title = node.textContent
      return false
    }
    return true
  })
  return title
}

export function getDocumentStats(editor: Editor): { wordCount: number; blockCount: number } {
  const text = editor.getText().trim()
  const words = text ? text.split(/\s+/).length : 0
  let blocks = 0
  editor.state.doc.descendants((node) => {
    if (node.attrs.blockId) blocks++
  })
  return { wordCount: words, blockCount: blocks }
}

function findBlockPos(editor: Editor, blockId: string): { node: PmNode; pos: number } | null {
  let result: { node: PmNode; pos: number } | null = null
  editor.state.doc.descendants((node, pos): boolean => {
    if (result) return false
    if (node.attrs.blockId === blockId) {
      result = { node, pos }
      return false
    }
    return true
  })
  return result
}

function readSingleBlock(
  node: PmNode,
  blockId: string,
  textOffset: number,
  includeFormatting: boolean
): ReadBlockEntry {
  const type = node.type.name
  const attrs = pickSemanticAttrs(type, node.attrs as Record<string, unknown>)

  if (type === 'table') {
    const formattedRows = serializeTableRowsFormatted(node)
    const flatText = node.textContent
    const slicedText = flatText.slice(textOffset, textOffset + MAX_CHARS_PER_BLOCK)
    const truncated = textOffset + MAX_CHARS_PER_BLOCK < flatText.length

    const rows = includeFormatting
      ? formattedRows
      : formattedRows.map((row) => row.map(({ text }) => ({ text })))

    const entry: ReadBlockEntry = { blockId, type, text: slicedText, rows }
    if (attrs) entry.attrs = attrs
    entry.charLength = flatText.length
    if (truncated || textOffset > 0) {
      entry.truncated = truncated
      entry.totalChars = flatText.length
    }
    return entry
  }

  const fullRuns = includeFormatting
    ? serializeBlockRuns(node).runs
    : [{ text: node.textContent }]

  const { runs, text, truncated, totalChars } = truncateRuns(fullRuns, textOffset, MAX_CHARS_PER_BLOCK)

  const entry: ReadBlockEntry = { blockId, type, text }
  if (includeFormatting) {
    entry.runs = runs
    const blockStyle = extractBlockStyleFromNode(node)
    if (blockStyle) entry.blockStyle = blockStyle
  }
  if (attrs) entry.attrs = attrs
  const flatLen = node.textContent.length
  entry.charLength = flatLen
  if (truncated) {
    entry.truncated = true
    entry.totalChars = totalChars
  } else if (textOffset > 0) {
    entry.totalChars = totalChars
  } else if (flatLen > 0) {
    entry.totalChars = flatLen
  }

  return entry
}

export function getTableOfContents(editor: Editor): TableOfContentsResult {
  const index = getDocumentIndex(editor)
  return {
    title: getDocumentTitle(editor),
    headingCount: index.headings.length,
    headings: index.headings.map((h) => ({
      blockId: h.blockId,
      level: h.level,
      text: h.text
    }))
  }
}

export function readBlocks(
  editor: Editor,
  blockIds: string[],
  options?: { textOffset?: number; includeFormatting?: boolean }
): ReadBlocksResult | { error: string } {
  if (blockIds.length > MAX_BLOCKS_PER_READ) {
    return {
      error: `Too many blockIds (${blockIds.length}). Maximum is ${MAX_BLOCKS_PER_READ} per call. Split into multiple read_blocks calls.`
    }
  }

  const index = getDocumentIndex(editor)
  const textOffset = options?.textOffset ?? 0
  const includeFormatting = options?.includeFormatting !== false
  const blocks: ReadBlockEntry[] = []
  const notFound: string[] = []
  let anyTruncated = false

  for (const blockId of blockIds) {
    const found = findBlockPos(editor, blockId)
    if (!found) {
      notFound.push(blockId)
      continue
    }
    const entry = readSingleBlock(found.node, blockId, textOffset, includeFormatting)
    if (entry.truncated) anyTruncated = true

    const orderIdx = index.blockOrder.indexOf(blockId)
    if (orderIdx >= 0) {
      entry.prevBlockId = orderIdx > 0 ? index.blockOrder[orderIdx - 1] : null
      entry.nextBlockId =
        orderIdx < index.blockOrder.length - 1 ? index.blockOrder[orderIdx + 1] : null
    }

    blocks.push(entry)
  }

  const hints: string[] = []
  if (notFound.length > 0) {
    hints.push(`Block IDs not found: ${notFound.join(', ')}. Use get_document_outline or search_document to find valid IDs.`)
  }
  if (anyTruncated) {
    hints.push(
      `Some blocks were truncated at ${MAX_CHARS_PER_BLOCK} chars. Re-call read_blocks with a single blockId and textOffset to continue.`
    )
  }

  return {
    blocks,
    notFound,
    truncated: anyTruncated,
    hint: hints.length > 0 ? hints.join(' ') : undefined
  }
}

export function readSelection(editor: Editor): SelectionReadResult | null {
  const { from, to, empty } = editor.state.selection
  if (empty) return null

  const { text, runs } = serializeRangeRuns(editor.state.doc, from, to)
  const blockIds: string[] = []
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.attrs.blockId) blockIds.push(node.attrs.blockId)
  })

  const uniqueBlockIds = [...new Set(blockIds)]
  let blockStyle: BlockStyle | undefined

  if (uniqueBlockIds.length === 1) {
    const found = findBlockPos(editor, uniqueBlockIds[0])
    if (found) {
      blockStyle = extractBlockStyleFromNode(found.node)
    }
  }

  return {
    text,
    runs,
    blockIds: uniqueBlockIds,
    ...(blockStyle ? { blockStyle } : {})
  }
}

function findAllMatchesInText(text: string, needle: string, caseSensitive: boolean): number[] {
  const positions: number[] = []
  const haystack = caseSensitive ? text : text.toLowerCase()
  const searchNeedle = caseSensitive ? needle : needle.toLowerCase()
  let start = 0
  while (start <= haystack.length) {
    const idx = haystack.indexOf(searchNeedle, start)
    if (idx === -1) break
    positions.push(idx)
    start = idx + Math.max(1, searchNeedle.length)
  }
  return positions
}

function collectSectionBlockIds(
  editor: Editor,
  startBlockId: string,
  endBlockId?: string,
  maxBlocks?: number
): { blockIds: string[]; endId: string | null; totalInSection: number } | { error: string } {
  const index = getDocumentIndex(editor)
  const startIdx = index.blockOrder.indexOf(startBlockId)
  if (startIdx < 0) {
    return { error: `startBlockId ${startBlockId} not found. Use get_table_of_contents or search_document.` }
  }

  let endIdx = index.blockOrder.length
  if (endBlockId) {
    const explicitEnd = index.blockOrder.indexOf(endBlockId)
    if (explicitEnd < 0) {
      return { error: `endBlockId ${endBlockId} not found.` }
    }
    if (explicitEnd <= startIdx) {
      return { error: 'endBlockId must come after startBlockId in the document.' }
    }
    endIdx = explicitEnd
  } else {
    const startBlock = index.blocks.get(startBlockId)
    const startLevel = startBlock?.type === 'heading' ? (startBlock.level ?? 1) : null

    if (startLevel != null) {
      for (let i = startIdx + 1; i < index.blockOrder.length; i++) {
        const bid = index.blockOrder[i]
        const block = index.blocks.get(bid)
        if (block?.type === 'heading' && (block.level ?? 1) <= startLevel) {
          endIdx = i
          break
        }
      }
    }
  }

  const sectionIds = index.blockOrder.slice(startIdx, endIdx)
  const limit = Math.min(maxBlocks ?? DEFAULT_SECTION_BLOCKS, MAX_SECTION_BLOCKS)
  const blockIds = sectionIds.slice(0, limit)
  const endId = blockIds.length > 0 ? blockIds[blockIds.length - 1] : null

  return {
    blockIds,
    endId,
    totalInSection: sectionIds.length
  }
}

export function readSection(
  editor: Editor,
  options: {
    startBlockId: string
    endBlockId?: string
    maxBlocks?: number
    includeFormatting?: boolean
  }
): ReadSectionResult | { error: string } {
  const collected = collectSectionBlockIds(
    editor,
    options.startBlockId,
    options.endBlockId,
    options.maxBlocks
  )
  if ('error' in collected) return collected

  const readResult = readBlocks(editor, collected.blockIds, {
    includeFormatting: options.includeFormatting
  })
  if ('error' in readResult) return readResult

  const hints: string[] = []
  if (collected.totalInSection > collected.blockIds.length) {
    hints.push(
      `Section has ${collected.totalInSection} blocks; returned ${collected.blockIds.length}. Increase maxBlocks (max ${MAX_SECTION_BLOCKS}) or read remaining blocks with read_blocks using nextBlockId hints.`
    )
  }
  if (readResult.hint) hints.push(readResult.hint)

  return {
    startBlockId: options.startBlockId,
    endBlockId: collected.endId,
    blocks: readResult.blocks,
    truncated: collected.totalInSection > collected.blockIds.length || readResult.truncated,
    totalBlocksInSection: collected.totalInSection,
    hint: hints.length > 0 ? hints.join(' ') : undefined
  }
}

function blockMatchesScope(
  type: string,
  scope: 'all' | 'headings' | 'body'
): boolean {
  if (scope === 'all') return true
  if (scope === 'headings') return type === 'heading'
  return type !== 'heading'
}

function getCandidateBlockIds(
  index: ReturnType<typeof getDocumentIndex>,
  query: string,
  scope: 'all' | 'headings' | 'body'
): Set<string> {
  const tokens = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length >= 3)

  let candidates: Set<string> | null = null
  const sourceIndex = scope === 'headings' ? index.headingIndex : index.invertedIndex

  if (tokens.length > 0) {
    for (const token of tokens) {
      const hits = sourceIndex.get(token)
      if (!hits || hits.size === 0) {
        return new Set()
      }
      if (!candidates) {
        candidates = new Set(hits)
      } else {
        candidates = new Set(Array.from(candidates).filter((id) => hits.has(id)))
      }
    }
    return candidates ?? new Set(index.blockOrder)
  }

  return new Set(
    index.blockOrder.filter((id) => {
      const block = index.blocks.get(id)
      return block && blockMatchesScope(block.type, scope)
    })
  )
}

function searchSingleQuery(
  editor: Editor,
  query: string,
  options: {
    caseSensitive?: boolean
    scope?: 'all' | 'headings' | 'body'
    blockTypes?: string[]
  }
): SearchMatch[] {
  if (!query.trim()) return []

  const index = getDocumentIndex(editor)
  const scope = options.scope ?? 'all'
  const caseSensitive = options.caseSensitive ?? false
  const blockTypeSet = options.blockTypes?.length ? new Set(options.blockTypes) : null
  const candidates = getCandidateBlockIds(index, query, scope)
  const matches: SearchMatch[] = []

  for (const blockId of index.blockOrder) {
    if (!candidates.has(blockId)) continue
    const block = index.blocks.get(blockId)
    if (!block) continue
    if (!blockMatchesScope(block.type, scope)) continue
    if (blockTypeSet && !blockTypeSet.has(block.type)) continue

    const text = block.text
    const positions = findAllMatchesInText(text, query, caseSensitive)
    for (let i = 0; i < positions.length; i++) {
      const idx = positions[i]
      matches.push({
        refId: '',
        blockId,
        type: block.type,
        snippet: buildSnippet(text, idx, query.length),
        matchIndex: i,
        query
      })
    }
  }

  return matches
}

export function searchDocument(
  editor: Editor,
  queryOrOptions: string | SearchDocumentOptions,
  legacyOptions?: Omit<SearchDocumentOptions, 'query'>
): SearchDocumentResult {
  const options: SearchDocumentOptions =
    typeof queryOrOptions === 'string'
      ? { query: queryOrOptions, ...legacyOptions }
      : queryOrOptions

  const pageSize = options.maxResults ?? DEFAULT_SEARCH_PAGE_SIZE
  const offset = Math.max(0, options.offset ?? 0)
  const queries: string[] = []

  if (options.queries?.length) {
    queries.push(...options.queries.slice(0, MAX_SEARCH_QUERIES))
  }
  if (options.query?.trim()) {
    queries.push(options.query.trim())
  }

  const uniqueQueries = [...new Set(queries.map((q) => q.trim()).filter(Boolean))]
  const seenBlockQuery = new Set<string>()
  const allMatches: SearchMatch[] = []

  for (const q of uniqueQueries.length > 0 ? uniqueQueries : ['']) {
    if (!q) continue
    const hits = searchSingleQuery(editor, q, {
      caseSensitive: options.caseSensitive,
      scope: options.scope,
      blockTypes: options.blockTypes
    })
    for (const hit of hits) {
      const key = `${hit.blockId}:${hit.matchIndex}:${q}`
      if (seenBlockQuery.has(key)) continue
      seenBlockQuery.add(key)
      allMatches.push(hit)
    }
  }

  allMatches.forEach((m, i) => {
    m.refId = `s${i + 1}`
  })

  const page = allMatches.slice(offset, offset + pageSize)
  const hasMore = offset + pageSize < allMatches.length

  const hints: string[] = []
  if (hasMore) {
    hints.push(`More matches available. Call search_document with offset=${offset + pageSize} to continue.`)
  }
  if (page.length > 0) {
    hints.push('Use read_blocks with matching blockIds or read_section for contiguous sections.')
  }
  if (allMatches.length === 0 && uniqueQueries.length > 0) {
    hints.push('Try get_table_of_contents for structure or search with shorter keywords / queries[] synonyms.')
  }

  return {
    matches: page,
    totalMatches: allMatches.length,
    offset,
    hasMore,
    hint: hints.length > 0 ? hints.join(' ') : undefined
  }
}

export function getBlockById(editor: Editor, blockId: string): { node: PmNode; pos: number } | null {
  return findBlockPos(editor, blockId)
}

/** Find document positions for exact text within a block (handles inline marks). */
export function findTextInBlock(
  editor: Editor,
  blockId: string,
  searchText: string,
  occurrence = 1
): { from: number; to: number } | null {
  const result = findTextOccurrences(editor, blockId, searchText)
  if (!result) return null
  const idx = Math.max(1, occurrence) - 1
  if (idx >= result.matches.length) return null
  return result.matches[idx]
}

export interface TextOccurrenceResult {
  matches: Array<{ from: number; to: number }>
  flatPositions: number[]
}

/** All occurrences of searchText in a block's flat textContent. */
export function findTextOccurrences(
  editor: Editor,
  blockId: string,
  searchText: string
): TextOccurrenceResult | null {
  const found = findBlockPos(editor, blockId)
  if (!found || !searchText) return null

  const { node, pos } = found
  const flat = node.textContent
  const flatPositions: number[] = []
  let start = 0
  while (start <= flat.length) {
    const idx = flat.indexOf(searchText, start)
    if (idx === -1) break
    flatPositions.push(idx)
    start = idx + Math.max(1, searchText.length)
  }

  if (flatPositions.length === 0) return { matches: [], flatPositions: [] }

  const blockStart = pos + 1
  const matches = flatPositions.map((idx) => ({
    from: blockStart + idx,
    to: blockStart + idx + searchText.length
  }))
  return { matches, flatPositions }
}

export function getBlockCharLength(editor: Editor, blockId: string): number | null {
  const found = findBlockPos(editor, blockId)
  if (!found) return null
  return found.node.textContent.length
}

/** Map 0-based char offsets in block flat text to document positions. */
export function blockTextOffsetToRange(
  editor: Editor,
  blockId: string,
  startOffset: number,
  endOffset: number
): { from: number; to: number; charLength: number } | { error: string } {
  const found = findBlockPos(editor, blockId)
  if (!found) return { error: `Block ${blockId} not found` }

  const charLength = found.node.textContent.length
  const start = Math.max(0, Math.floor(startOffset))
  const end = Math.max(start, Math.floor(endOffset))

  if (end > charLength) {
    return {
      error: `Offsets ${start}-${end} out of range (block length ${charLength}). Re-read block with read_blocks.`
    }
  }

  const blockStart = found.pos + 1
  return { from: blockStart + start, to: blockStart + end, charLength }
}

/** Resolve runIndex (0-based) from read_blocks runs to a document range. */
export function runIndexToRange(
  editor: Editor,
  blockId: string,
  runIndex: number
): { from: number; to: number; startOffset: number; endOffset: number } | { error: string } {
  const found = findBlockPos(editor, blockId)
  if (!found) return { error: `Block ${blockId} not found` }

  const { runs } = serializeBlockRuns(found.node)
  const idx = Math.floor(runIndex)
  if (idx < 0 || idx >= runs.length) {
    return {
      error: `runIndex ${runIndex} out of range (block has ${runs.length} runs). Re-read with read_blocks.`
    }
  }

  const run = runs[idx]
  const startOffset = run.charStart ?? 0
  const endOffset = run.charEnd ?? startOffset + run.text.length
  const range = blockTextOffsetToRange(editor, blockId, startOffset, endOffset)
  if ('error' in range) return range

  return { from: range.from, to: range.to, startOffset, endOffset }
}

/** Full inline content range inside a block (excludes block wrapper). */
export function getBlockContentRange(
  editor: Editor,
  blockId: string
): { from: number; to: number; charLength: number } | { error: string } {
  const found = findBlockPos(editor, blockId)
  if (!found) return { error: `Block ${blockId} not found` }

  const { node, pos } = found
  const charLength = node.textContent.length
  return {
    from: pos + 1,
    to: pos + node.nodeSize - 1,
    charLength
  }
}
