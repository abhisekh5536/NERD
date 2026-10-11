import type { WordCloneEditorRef } from '../editor/editorBridge'
import { collectParagraphSnapshots } from '../editor/editorBridge'
import {
  buildDocumentOutlineView,
  readBlocks,
  readSection,
  readSelection,
  searchDocument,
  getTableOfContents,
  getBlockById,
  findTextOccurrences,
  blockTextOffsetToRange,
  runIndexToRange,
  getBlockContentRange,
  getBlockCharLength
} from './docService'
import { stageReplace, stageInsert, stageDelete, stageFormatRange, stageReplaceRange } from './suggestionService'
import { findParagraphText } from './docServiceHelpers'
import { deriveSuggestionDescription } from './editDescription'
import {
  FONT_FAMILIES,
  FONT_SIZES,
  THEME_COLORS_TOP,
  THEME_COLORS_SHADES,
  STANDARD_COLORS,
  HIGHLIGHT_COLORS
} from '../lib/editorStyles'

function styleIdFromName(style: string): string {
  switch (style) {
    case 'heading1':
      return 'Heading1'
    case 'heading2':
      return 'Heading2'
    case 'heading3':
      return 'Heading3'
    default:
      return 'Normal'
  }
}

function buildMarks(formatting: Record<string, unknown>): Record<string, unknown> {
  const marks: Record<string, unknown> = {}
  if (formatting.bold) marks.bold = true
  if (formatting.italic) marks.italic = true
  if (formatting.underline) marks.underline = true
  if (formatting.strike) marks.strike = true
  if (formatting.color) marks.color = { rgb: formatting.color }
  if (formatting.fontFamily) {
    marks.fontFamily = { ascii: formatting.fontFamily, hAnsi: formatting.fontFamily }
  }
  if (formatting.fontSize) {
    const n = Number.parseFloat(String(formatting.fontSize).replace(/pt$/i, ''))
    if (!Number.isNaN(n)) marks.fontSize = n
  }
  if (formatting.highlight && formatting.highlight !== 'none') {
    marks.highlight = formatting.highlight
  }
  return marks
}

export function executeToolCall(
  editor: WordCloneEditorRef,
  name: string,
  args: Record<string, unknown>
): unknown {
  switch (name) {
    case 'submit_plan':
      return {
        title: args.title,
        overview: args.overview,
        plan: args.plan,
        todos: args.todos ?? []
      }

    case 'get_table_of_contents':
      return getTableOfContents(editor)

    case 'get_available_styles':
      return {
        fontFamilies: FONT_FAMILIES,
        fontSizes: FONT_SIZES,
        themeColors: THEME_COLORS_TOP,
        themeColorShades: THEME_COLORS_SHADES,
        standardColors: STANDARD_COLORS,
        highlightColors: HIGHLIGHT_COLORS,
        textAlignments: ['left', 'center', 'right', 'justify'],
        paragraphStyles: ['paragraph', 'heading1', 'heading2', 'heading3', 'bulletList', 'orderedList', 'blockquote']
      }

    case 'get_document_outline':
      return buildDocumentOutlineView(editor)

    case 'read_blocks':
      return readBlocks(editor, (args.blockIds as string[]) ?? [], {
        textOffset: args.textOffset as number | undefined,
        includeFormatting: args.includeFormatting as boolean | undefined
      })

    case 'read_section':
      return readSection(editor, {
        startBlockId: args.startBlockId as string,
        endBlockId: args.endBlockId as string | undefined,
        maxBlocks: args.maxBlocks as number | undefined,
        includeFormatting: args.includeFormatting as boolean | undefined
      })

    case 'read_selection':
      return readSelection(editor) ?? { empty: true }

    case 'search_document':
      return searchDocument(editor, {
        query: args.query as string | undefined,
        queries: args.queries as string[] | undefined,
        caseSensitive: args.caseSensitive as boolean | undefined,
        maxResults: args.maxResults as number | undefined,
        offset: args.offset as number | undefined,
        scope: args.scope as 'all' | 'headings' | 'body' | undefined,
        blockTypes: args.blockTypes as string[] | undefined
      })

    case 'replace_block':
      return executeReplaceBlock(editor, args)

    case 'insert_block':
      return executeInsertBlock(editor, args)

    case 'insert_blocks':
      return executeInsertBlocks(editor, args)

    case 'insert_list':
      return executeInsertList(editor, args)

    case 'delete_blocks':
      return executeDeleteBlocks(editor, args)

    case 'batch_edit':
      return executeBatchEdit(editor, args)

    case 'format_text':
      return executeFormatText(editor, args)

    case 'apply_style':
      return executeApplyStyle(editor, args)

    case 'insert_page_break':
      return executeInsertPageBreak(editor, args)

    case 'insert_table':
      return executeInsertTable(editor, args)

    case 'insert_image':
      return executeInsertImage(editor, args)

    case 'set_page_setup':
      return executeSetPageSetup(editor, args)

    case 'set_page_numbers':
      return executeSetPageNumbers(editor, args)

    default:
      return {
        error: `Unknown tool: "${name}". Edit tools: insert_block, insert_blocks, batch_edit, replace_block (full/range/patch modes), insert_list, delete_blocks, format_text, apply_style. Read tools: get_table_of_contents, read_blocks, read_section, read_selection, search_document. Call the correct tool name.`
      }
  }
}

function executeReplaceBlock(editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  const blockId = args.blockId as string
  if (!blockId) return { error: 'blockId is required' }

  const hasRange = args.startOffset !== undefined && args.endOffset !== undefined
  const hasPatch = args.oldText !== undefined && args.newText !== undefined
  const hasFull = args.text !== undefined

  if (hasRange && (hasPatch || hasFull)) {
    return { error: 'Use one replace mode only: full (text), range (startOffset+endOffset+newText), or patch (oldText+newText).' }
  }
  if (hasPatch && hasFull) {
    return { error: 'Use one replace mode only: full (text), range, or patch.' }
  }

  if (hasRange) return executeReplaceBlockRange(editor, blockId, args)
  if (hasPatch) return executeReplaceBlockPatch(editor, blockId, args)

  const text = args.text as string
  if (text === undefined) {
    return {
      error:
        'Provide text for full replace, or startOffset+endOffset+newText for range mode, or oldText+newText for patch mode.'
    }
  }

  const description = deriveSuggestionDescription('replace_block', args)
  const found = getBlockById(editor, blockId)
  if (!found) return { error: `Block ${blockId} not found` }

  const result = stageReplace(editor, blockId, text, description)
  if (!result.success) return result
  return { success: true, blockId, mode: 'full', charLength: found.text.length }
}

function executeReplaceBlockRange(
  editor: WordCloneEditorRef,
  blockId: string,
  args: Record<string, unknown>
): unknown {
  const startOffset = args.startOffset as number
  const endOffset = args.endOffset as number
  const newText = (args.newText as string) ?? ''

  const resolved = blockTextOffsetToRange(editor, blockId, startOffset, endOffset)
  if ('error' in resolved) return { error: resolved.error }

  const description = `Replace chars ${startOffset}-${endOffset}`
  const result = stageReplaceRange(
    editor,
    blockId,
    resolved.from,
    resolved.to,
    newText,
    description
  )
  if (!result.success) return result
  return {
    success: true,
    blockId,
    mode: 'range',
    startOffset,
    endOffset,
    charLength: resolved.charLength
  }
}

function executeReplaceBlockPatch(
  editor: WordCloneEditorRef,
  blockId: string,
  args: Record<string, unknown>
): unknown {
  const oldText = args.oldText as string
  const newText = (args.newText as string) ?? ''
  const occurrence = (args.occurrence as number) ?? 1

  const found = getBlockById(editor, blockId)
  if (!found) return { error: `Block ${blockId} not found` }

  const matches = findTextOccurrences(editor, blockId, oldText)
  if (matches.length === 0) {
    return { error: `oldText not found in block ${blockId}. Re-read with read_blocks.` }
  }
  if (matches.length > 1 && args.occurrence === undefined) {
    return {
      error: `oldText matches ${matches.length} times. Pass occurrence (1-${matches.length}) or use range mode with offsets from read_blocks.`
    }
  }

  const idx = Math.max(1, occurrence) - 1
  if (idx >= matches.length) {
    return { error: `occurrence ${occurrence} out of range (${matches.length} matches).` }
  }

  const match = matches[idx]
  const description = `Replace "${oldText.slice(0, 40)}${oldText.length > 40 ? '…' : ''}"`
  const result = stageReplaceRange(editor, blockId, match.from, match.to, newText, description)
  if (!result.success) return result

  return {
    success: true,
    blockId,
    mode: 'patch',
    startOffset: match.from,
    endOffset: match.to,
    charLength: found.text.length + newText.length - oldText.length
  }
}

function executeInsertBlock(editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  const afterBlockId = args.afterBlockId as string
  const text = (args.text as string) || ''
  const description = deriveSuggestionDescription('insert_block', args)
  return stageInsert(editor, afterBlockId, text, description, {
    blockType: args.type as string | undefined
  })
}

const MAX_INSERT_BLOCKS = 20
const MAX_BATCH_EDITS = 15

function executeInsertBlocks(editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  const blocks = (args.blocks as Array<Record<string, unknown>>) ?? []
  if (blocks.length === 0) return { error: 'blocks array is required and must not be empty.' }
  if (blocks.length > MAX_INSERT_BLOCKS) {
    return { error: `Too many blocks (${blocks.length}). Maximum is ${MAX_INSERT_BLOCKS}.` }
  }

  const inserted: Array<{ blockId?: string; afterBlockId: string; type?: string }> = []
  let chainAnchor: string | undefined

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    const afterBlockId =
      i === 0 ? (block.afterBlockId as string) : (chainAnchor ?? (block.afterBlockId as string))
    if (!afterBlockId) {
      return {
        error:
          i === 0
            ? `blocks[0] requires afterBlockId.`
            : `blocks[${i}] could not resolve chain anchor from prior insert.`,
        partial: inserted
      }
    }

    const result = executeInsertBlock(editor, {
      afterBlockId,
      type: block.type,
      text: block.text
    }) as { success?: boolean; blockId?: string; error?: string }

    if (!result.success || !result.blockId) {
      return {
        error: result.error ?? `insert_blocks failed at index ${i}.`,
        failedAt: i,
        partial: inserted
      }
    }

    chainAnchor = result.blockId
    inserted.push({
      blockId: result.blockId,
      afterBlockId,
      type: block.type as string | undefined
    })
  }

  return { success: true, count: inserted.length, inserted }
}

function executeBatchEdit(editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  const edits = (args.edits as Array<Record<string, unknown>>) ?? []
  if (edits.length === 0) return { error: 'edits array is required and must not be empty.' }
  if (edits.length > MAX_BATCH_EDITS) {
    return { error: `Too many edits (${edits.length}). Maximum is ${MAX_BATCH_EDITS}.` }
  }

  const allowedOps = new Set(['replace_block', 'format_text', 'apply_style', 'delete_blocks'])
  const results: unknown[] = []

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i]!
    const op = edit.op as string
    if (!op || !allowedOps.has(op)) {
      return { error: `edits[${i}] has invalid op "${op ?? ''}".`, results }
    }

    const { op: _op, ...opArgs } = edit
    const result = executeToolCall(editor, op, opArgs)
    const hasError = typeof result === 'object' && result !== null && 'error' in result
    results.push({ index: i, op, ...(hasError ? { error: (result as { error: string }).error } : result) })

    if (hasError) {
      return {
        success: false,
        failedAt: i,
        op,
        error: (result as { error: string }).error,
        results
      }
    }
  }

  return { success: true, count: results.length, results }
}

function executeInsertList(editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  const afterBlockId = args.afterBlockId as string
  const items = (args.items as string[]) || []
  const description = deriveSuggestionDescription('insert_list', args)
  const text = items.map((item) => `• ${item}`).join('\n')
  return stageInsert(editor, afterBlockId, text, description)
}

function executeDeleteBlocks(editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  const blockIds = (args.blockIds as string[]) ?? []
  const description = deriveSuggestionDescription('delete_blocks', args)
  return stageDelete(editor, blockIds, description)
}

function applyFormattingToBlock(
  editor: WordCloneEditorRef,
  blockId: string,
  search: string | undefined,
  formatting: Record<string, unknown>
): void {
  const marks = buildMarks(formatting)
  if (Object.keys(marks).length === 0) return
  editor.applyFormatting({ paraId: blockId, search, marks: marks as never })
}

function formatResultPayload(
  blockId: string,
  startOffset: number,
  endOffset: number,
  editor?: WordCloneEditorRef
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    success: true,
    blockId,
    startOffset,
    endOffset
  }
  if (editor) {
    const charLength = getBlockCharLength(editor, blockId)
    if (charLength != null) payload.charLength = charLength
  }
  return payload
}

function executeFormatText(editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  const formatting = (args.formatting as Record<string, unknown>) ?? {}
  const scope = ((args.scope as string) || 'text').toLowerCase()

  if (scope === 'block') {
    const ids = (args.blockIds as string[])?.length
      ? (args.blockIds as string[])
      : args.blockId
        ? [args.blockId as string]
        : []
    if (ids.length === 0) return { error: 'scope "block" requires blockId or blockIds.' }

    const results: Record<string, unknown>[] = []
    for (const blockId of ids) {
      const content = getBlockContentRange(editor, blockId)
      if ('error' in content) return { error: content.error }
      applyFormattingToBlock(editor, blockId, undefined, formatting)
      stageFormatRange(editor, blockId, 0, content.charLength, 'Format block')
      results.push(formatResultPayload(blockId, 0, content.charLength, editor))
    }

    return ids.length === 1 ? results[0] : { success: true, results }
  }

  const blockId = args.blockId as string
  if (!blockId) return { error: 'blockId is required for format_text.' }

  if (scope === 'range') {
    const startOffset = args.startOffset as number
    const endOffset = args.endOffset as number
    if (startOffset === undefined || endOffset === undefined) {
      return { error: 'scope "range" requires startOffset and endOffset.' }
    }

    const resolved = blockTextOffsetToRange(editor, blockId, startOffset, endOffset)
    if ('error' in resolved) return { error: resolved.error }

    const text = findParagraphText(editor, blockId)
    const search = text?.slice(resolved.from, resolved.to)
    applyFormattingToBlock(editor, blockId, search, formatting)
    stageFormatRange(editor, blockId, resolved.from, resolved.to, 'Format range')

    return formatResultPayload(blockId, startOffset, endOffset, editor)
  }

  if (scope === 'run') {
    const runIndex = args.runIndex as number
    if (runIndex === undefined) return { error: 'scope "run" requires runIndex from read_blocks.' }

    const resolved = runIndexToRange(editor, blockId, runIndex)
    if ('error' in resolved) return { error: resolved.error }

    const text = findParagraphText(editor, blockId)
    const search = text?.slice(resolved.startOffset, resolved.endOffset)
    applyFormattingToBlock(editor, blockId, search, formatting)
    stageFormatRange(editor, blockId, resolved.from, resolved.to, `Format run ${runIndex}`)

    return formatResultPayload(blockId, resolved.startOffset, resolved.endOffset, editor)
  }

  // scope "text" (default)
  const searchText = args.searchText as string
  if (!searchText) {
    return {
      error:
        'scope "text" requires searchText (keep short). For whole blocks use scope "block"; for spans use scope "range" with offsets from read_blocks.'
    }
  }

  const occurrence = (args.occurrence as number) ?? 1
  const matches = findTextOccurrences(editor, blockId, searchText)
  if (matches.length === 0) {
    return { error: `searchText not found in block ${blockId}. Re-read with read_blocks.` }
  }
  if (matches.length > 1 && args.occurrence === undefined) {
    return {
      error: `searchText matches ${matches.length} times. Pass occurrence (1-${matches.length}) or use scope "range" with offsets from read_blocks.`
    }
  }

  const idx = Math.max(1, occurrence) - 1
  if (idx >= matches.length) {
    return { error: `occurrence ${occurrence} out of range (${matches.length} matches).` }
  }

  const match = matches[idx]
  const text = findParagraphText(editor, blockId)
  const search = text?.slice(match.from, match.to)
  applyFormattingToBlock(editor, blockId, search, formatting)
  stageFormatRange(editor, blockId, match.from, match.to, 'Format text')

  return formatResultPayload(blockId, match.from, match.to, editor)
}

function executeApplyStyle(editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  const blockId = args.blockId as string
  const style = args.style as string | undefined

  if (!blockId) return { error: 'blockId is required' }
  if (!style) return { error: 'Provide style (paragraph, heading1, heading2, heading3).' }

  const found = getBlockById(editor, blockId)
  if (!found) return { error: `Block ${blockId} not found` }

  const styleId = styleIdFromName(style)
  const ok = editor.setParagraphStyle({ paraId: blockId, styleId })
  if (!ok) return { error: `Failed to apply style ${style}` }

  stageFormatRange(editor, blockId, 0, found.text.length, `Apply ${style}`, { type: 'style' })
  return { success: true, blockId, applied: style, charLength: found.text.length }
}

function executeInsertPageBreak(editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  const afterBlockId = args.afterBlockId as string
  const anchor = afterBlockId === '__start__'
    ? collectParagraphSnapshots(editor)[0]?.paraId
    : afterBlockId
  if (!anchor) return { error: 'Could not resolve page break anchor.' }
  const ok = editor.insertBreak({ paraId: anchor, type: 'page' })
  return ok ? { success: true, afterBlockId } : { error: 'Failed to insert page break.' }
}

function executeInsertTable(editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  const afterBlockId = args.afterBlockId as string
  const rows = Math.max(1, (args.rows as number) ?? 3)
  const cols = Math.max(1, (args.cols as number) ?? 3)
  const description = deriveSuggestionDescription('insert_table', args)
  const lines = [`[Table ${rows}x${cols}]`]
  for (let r = 0; r < rows; r++) {
    lines.push(Array.from({ length: cols }, (_, c) => `Cell ${r + 1}-${c + 1}`).join('\t'))
  }
  return stageInsert(editor, afterBlockId, lines.join('\n'), description)
}

function executeInsertImage(editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  const afterBlockId = args.afterBlockId as string
  const src = args.src as string
  const alt = (args.alt as string) ?? ''
  const description = deriveSuggestionDescription('insert_image', args)
  return stageInsert(editor, afterBlockId, `[Image: ${alt || src}]`, description)
}

function executeSetPageSetup(_editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  void args
  return {
    success: false,
    error: 'Page setup is available through the Layout tab in a future release. Section properties are preserved from the opened .docx.'
  }
}

function executeSetPageNumbers(_editor: WordCloneEditorRef, args: Record<string, unknown>): unknown {
  void args
  return {
    success: false,
    error: 'Page numbers are preserved from the opened .docx. Use Word to edit header/footer fields for now.'
  }
}
