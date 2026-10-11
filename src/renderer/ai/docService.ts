import type { WordCloneEditorRef } from '../editor/editorBridge'
import { collectParagraphSnapshots, getPlainText } from '../editor/editorBridge'

export type { BlockStyle, FormattedRun, InlineMarks } from './formatSerializer'

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
  charLength?: number
  prevBlockId?: string | null
  nextBlockId?: string | null
  truncated?: boolean
  totalChars?: number
}

export interface ReadBlocksResult {
  blocks: ReadBlockEntry[]
  notFound: string[]
  truncated: boolean
  hint?: string
}

export interface SelectionReadResult {
  text: string
  blockIds: string[]
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

export const MAX_OUTLINE_ENTRIES = 200
export const HEADINGS_ONLY_THRESHOLD = 500
export const BODY_PREVIEW_LIMIT = 50
export const MAX_BLOCKS_PER_READ = 10
export const MAX_CHARS_PER_BLOCK = 4000
export const DEFAULT_SEARCH_PAGE_SIZE = 20
export const MAX_SEARCH_QUERIES = 5
export const MAX_SECTION_BLOCKS = 25
export const DEFAULT_SECTION_BLOCKS = 15

interface ParagraphRecord {
  blockId: string
  text: string
  type: string
  level: number
  styleId?: string
}

function headingLevel(styleId?: string): number {
  if (!styleId) return 0
  const match = styleId.match(/(\d+)/)
  return match ? Number.parseInt(match[1], 10) : 1
}

function collectParagraphs(editor: WordCloneEditorRef): ParagraphRecord[] {
  return collectParagraphSnapshots(editor).map((para) => {
    const styleId = para.styleId
    const level = headingLevel(styleId)
    const isHeading = para.nodeType === 'heading' || level > 0 || /^Heading/i.test(styleId ?? '')
    return {
      blockId: para.paraId,
      text: para.text,
      styleId,
      type: isHeading ? 'heading' : 'paragraph',
      level: isHeading ? level || 1 : 0
    }
  })
}

function findParagraph(editor: WordCloneEditorRef, blockId: string): ParagraphRecord | null {
  return collectParagraphs(editor).find((p) => p.blockId === blockId) ?? null
}

export function serializeFragmentToHtml(_editor: WordCloneEditorRef, _fragment: unknown): string {
  return ''
}

export function serializeBlockToHtml(editor: WordCloneEditorRef, blockId: string): string {
  const para = findParagraph(editor, blockId)
  return para ? `<p>${para.text}</p>` : ''
}

export function serializeRangeToHtml(_editor: WordCloneEditorRef, _from: number, _to: number): string {
  return ''
}

export function getDocumentOutline(editor: WordCloneEditorRef): OutlineEntry[] {
  return collectParagraphs(editor).map((p) => ({
    blockId: p.blockId,
    level: p.level,
    text: p.text,
    type: p.type
  }))
}

export function buildDocumentOutlineView(editor: WordCloneEditorRef): DocumentOutlineView {
  const title = getDocumentTitle(editor)
  const stats = getDocumentStats(editor)
  const raw = getDocumentOutline(editor)
  const headingsOnly = stats.blockCount > HEADINGS_ONLY_THRESHOLD
  let bodyPreviewCount = 0
  const entries: OutlineEntry[] = []

  for (const entry of raw) {
    if (entries.length >= MAX_OUTLINE_ENTRIES) break
    if (headingsOnly && entry.type !== 'heading') {
      if (bodyPreviewCount >= BODY_PREVIEW_LIMIT) continue
      bodyPreviewCount++
    }
    entries.push(entry)
  }

  const truncated = raw.length > entries.length
  return {
    title,
    wordCount: stats.wordCount,
    blockCount: stats.blockCount,
    entries,
    truncated,
    totalEntries: raw.length,
    hint: truncated
      ? `Showing ${entries.length} of ${raw.length} blocks. Use search_document to find specific content.`
      : undefined
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

export function getDocumentTitle(editor: WordCloneEditorRef): string {
  const heading = collectParagraphs(editor).find((p) => p.type === 'heading' && p.level === 1)
  return heading?.text || 'Untitled'
}

export function getDocumentStats(editor: WordCloneEditorRef): { wordCount: number; blockCount: number } {
  const text = getPlainText(editor).trim()
  const words = text ? text.split(/\s+/).length : 0
  return { wordCount: words, blockCount: collectParagraphs(editor).length }
}

export function getTableOfContents(editor: WordCloneEditorRef): TableOfContentsResult {
  const headings = collectParagraphs(editor)
    .filter((p) => p.type === 'heading')
    .map((p) => ({ blockId: p.blockId, level: p.level, text: p.text }))
  return {
    title: getDocumentTitle(editor),
    headingCount: headings.length,
    headings
  }
}

export function readBlocks(
  editor: WordCloneEditorRef,
  blockIds: string[],
  opts?: { textOffset?: number; includeFormatting?: boolean }
): ReadBlocksResult {
  if (blockIds.length > MAX_BLOCKS_PER_READ) {
    return {
      blocks: [],
      notFound: [],
      truncated: false,
      hint: `Too many blockIds (${blockIds.length}). Maximum is ${MAX_BLOCKS_PER_READ}.`
    }
  }

  const all = collectParagraphs(editor)
  const indexById = new Map(all.map((p, i) => [p.blockId, i]))
  const blocks: ReadBlockEntry[] = []
  const notFound: string[] = []
  const textOffset = opts?.textOffset ?? 0

  for (const blockId of blockIds) {
    const idx = indexById.get(blockId)
    if (idx === undefined) {
      notFound.push(blockId)
      continue
    }
    const para = all[idx]
    const sliced = para.text.slice(textOffset, textOffset + MAX_CHARS_PER_BLOCK)
    blocks.push({
      blockId,
      type: para.type,
      text: sliced,
      charLength: para.text.length,
      prevBlockId: idx > 0 ? all[idx - 1].blockId : null,
      nextBlockId: idx < all.length - 1 ? all[idx + 1].blockId : null,
      truncated: textOffset + MAX_CHARS_PER_BLOCK < para.text.length,
      totalChars: para.text.length
    })
  }

  return { blocks, notFound, truncated: false }
}

export function readSelection(editor: WordCloneEditorRef): SelectionReadResult | null {
  const info = editor.getSelectionInfo()
  if (!info?.paraId) return null
  return {
    text: info.selectedText || info.paragraphText,
    blockIds: [info.paraId]
  }
}

export function readSection(
  editor: WordCloneEditorRef,
  opts: {
    startBlockId: string
    endBlockId?: string
    maxBlocks?: number
    includeFormatting?: boolean
  }
): ReadSectionResult | { error: string } {
  const all = collectParagraphs(editor)
  const startIdx = all.findIndex((p) => p.blockId === opts.startBlockId)
  if (startIdx < 0) return { error: `Start block ${opts.startBlockId} not found.` }

  let endIdx = all.length
  if (opts.endBlockId) {
    const foundEnd = all.findIndex((p) => p.blockId === opts.endBlockId)
    if (foundEnd >= 0) endIdx = foundEnd
  }

  const maxBlocks = Math.min(opts.maxBlocks ?? DEFAULT_SECTION_BLOCKS, MAX_SECTION_BLOCKS)
  const slice = all.slice(startIdx, endIdx).slice(0, maxBlocks)
  return {
    startBlockId: opts.startBlockId,
    endBlockId: opts.endBlockId ?? null,
    blocks: slice.map((p) => ({
      blockId: p.blockId,
      type: p.type,
      text: p.text,
      charLength: p.text.length
    })),
    truncated: endIdx - startIdx > maxBlocks,
    totalBlocksInSection: endIdx - startIdx
  }
}

export function searchDocument(
  editor: WordCloneEditorRef,
  opts: SearchDocumentOptions
): SearchDocumentResult {
  const queries =
    opts.queries?.length ? opts.queries.slice(0, MAX_SEARCH_QUERIES) : opts.query ? [opts.query] : []
  if (queries.length === 0) {
    return { matches: [], totalMatches: 0, offset: opts.offset ?? 0, hasMore: false }
  }

  const offset = opts.offset ?? 0
  const maxResults = opts.maxResults ?? DEFAULT_SEARCH_PAGE_SIZE
  const allMatches: SearchMatch[] = []

  for (const query of queries) {
    const hits = editor.findInDocument(query, { caseSensitive: opts.caseSensitive })
    for (const hit of hits) {
      const para = findParagraph(editor, hit.paraId)
      if (!para) continue
      if (opts.scope === 'headings' && para.type !== 'heading') continue
      if (opts.blockTypes?.length && !opts.blockTypes.includes(para.type)) continue
      allMatches.push({
        refId: hit.paraId,
        blockId: hit.paraId,
        type: para.type,
        snippet: `${hit.before}${hit.match}${hit.after}`,
        matchIndex: 0,
        query
      })
    }
  }

  const page = allMatches.slice(offset, offset + maxResults)
  return {
    matches: page,
    totalMatches: allMatches.length,
    offset,
    hasMore: offset + maxResults < allMatches.length
  }
}

export function getBlockById(
  editor: WordCloneEditorRef,
  blockId: string
): { blockId: string; text: string; type: string; level: number } | null {
  const para = findParagraph(editor, blockId)
  if (!para) return null
  return para
}

export function clampDocPosition(_editor: WordCloneEditorRef, pos: number): number {
  return pos
}

export function resolveInsertAnchor(
  editor: WordCloneEditorRef,
  afterBlockId: string
): { insertAfterBlockId: string } | { error: string } {
  if (afterBlockId === '__start__') {
    return { insertAfterBlockId: '__start__' }
  }
  const para = findParagraph(editor, afterBlockId)
  if (!para) return { error: `Block ${afterBlockId} not found.` }
  return { insertAfterBlockId: afterBlockId }
}

export function getLastInsertedBlockId(
  editor: WordCloneEditorRef,
  afterBlockId: string
): string | null {
  const snapshots = collectParagraphSnapshots(editor)
  if (afterBlockId === '__start__') return snapshots[0]?.paraId ?? null
  const anchorIdx = snapshots.findIndex((p) => p.paraId === afterBlockId)
  if (anchorIdx >= 0 && anchorIdx + 1 < snapshots.length) {
    return snapshots[anchorIdx + 1]!.paraId
  }
  return null
}

export function findTextInBlock(
  editor: WordCloneEditorRef,
  blockId: string,
  searchText: string
): { from: number; to: number } | null {
  const para = findParagraph(editor, blockId)
  if (!para) return null
  const idx = para.text.indexOf(searchText)
  if (idx < 0) return null
  return { from: idx, to: idx + searchText.length }
}

export function findTextOccurrences(
  editor: WordCloneEditorRef,
  blockId: string,
  searchText: string
): Array<{ from: number; to: number; index: number }> {
  const para = findParagraph(editor, blockId)
  if (!para || !searchText) return []
  const results: Array<{ from: number; to: number; index: number }> = []
  let start = 0
  let index = 0
  while (start <= para.text.length) {
    const found = para.text.indexOf(searchText, start)
    if (found < 0) break
    results.push({ from: found, to: found + searchText.length, index })
    index++
    start = found + searchText.length
  }
  return results
}

export function getBlockCharLength(editor: WordCloneEditorRef, blockId: string): number | null {
  return findParagraph(editor, blockId)?.text.length ?? null
}

export function blockTextOffsetToRange(
  editor: WordCloneEditorRef,
  blockId: string,
  startOffset: number,
  endOffset: number
): { from: number; to: number; charLength: number } | { error: string } {
  const len = getBlockCharLength(editor, blockId)
  if (len == null) return { error: `Block ${blockId} not found` }
  if (startOffset < 0 || endOffset > len || startOffset > endOffset) {
    return { error: 'Invalid offset range for block.' }
  }
  return { from: startOffset, to: endOffset, charLength: len }
}

export function runIndexToRange(
  editor: WordCloneEditorRef,
  blockId: string,
  runIndex: number
): { from: number; to: number; startOffset: number; endOffset: number } | { error: string } {
  const para = findParagraph(editor, blockId)
  if (!para) return { error: `Block ${blockId} not found` }
  if (runIndex !== 0) return { error: 'Run-level formatting uses the full paragraph in OOXML mode.' }
  return { from: 0, to: para.text.length, startOffset: 0, endOffset: para.text.length }
}

export function getBlockContentRange(
  editor: WordCloneEditorRef,
  blockId: string
): { from: number; to: number; charLength: number } | { error: string } {
  const len = getBlockCharLength(editor, blockId)
  if (len == null) return { error: `Block ${blockId} not found` }
  return { from: 0, to: len, charLength: len }
}
