import type { Editor } from '@tiptap/core'
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
import { deriveSuggestionDescription } from './editDescription'
import { resolvePageSize, inchToPx } from '../lib/units'
import {
  FONT_FAMILIES,
  FONT_SIZES,
  THEME_COLORS_TOP,
  THEME_COLORS_SHADES,
  STANDARD_COLORS,
  HIGHLIGHT_COLORS
} from '../lib/editorStyles'

export function executeToolCall(
  editor: Editor,
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

    case 'insert_list':
      return executeInsertList(editor, args)

    case 'delete_blocks':
      return executeDeleteBlocks(editor, args)

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
      return { error: `Unknown tool: ${name}` }
  }
}

function executeReplaceBlock(editor: Editor, args: Record<string, unknown>): unknown {
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

  if (hasRange) {
    return executeReplaceBlockRange(editor, blockId, args)
  }
  if (hasPatch) {
    return executeReplaceBlockPatch(editor, blockId, args)
  }

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

  const newJson: any = { type: found.node.type.name }
  if (text) {
    if (['bulletList', 'orderedList'].includes(found.node.type.name)) {
      newJson.type = 'paragraph'
      newJson.content = [{ type: 'text', text }]
    } else if (found.node.type.name === 'listItem') {
      newJson.content = [{ type: 'paragraph', content: [{ type: 'text', text }] }]
    } else {
      newJson.content = [{ type: 'text', text }]
    }
  }

  const preservedAttrs: Record<string, unknown> = {}
  if (found.node.attrs.blockId) {
    preservedAttrs.blockId = found.node.attrs.blockId
  }
  if (found.node.type.name === 'heading') {
    preservedAttrs.level = found.node.attrs.level ?? 1
  }
  if (Object.keys(preservedAttrs).length > 0) {
    newJson.attrs = preservedAttrs
  }

  const result = stageReplace(editor, blockId, newJson, description)
  if (!result.success) return result
  return { success: true, blockId, mode: 'full', charLength: found.node.textContent.length }
}

function executeReplaceBlockRange(
  editor: Editor,
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
  editor: Editor,
  blockId: string,
  args: Record<string, unknown>
): unknown {
  const oldText = args.oldText as string
  const newText = (args.newText as string) ?? ''
  const occurrence = (args.occurrence as number) ?? 1

  const found = getBlockById(editor, blockId)
  if (!found) return { error: `Block ${blockId} not found` }

  const occurrences = findTextOccurrences(editor, blockId, oldText)
  if (!occurrences || occurrences.matches.length === 0) {
    return {
      error: `oldText not found in block ${blockId}. Re-read with read_blocks.`
    }
  }
  if (occurrences.matches.length > 1 && args.occurrence === undefined) {
    return {
      error: `oldText matches ${occurrences.matches.length} times. Pass occurrence (1-${occurrences.matches.length}) or use range mode with offsets from read_blocks.`
    }
  }

  const idx = Math.max(1, occurrence) - 1
  if (idx >= occurrences.matches.length) {
    return {
      error: `occurrence ${occurrence} out of range (${occurrences.matches.length} matches).`
    }
  }

  const match = occurrences.matches[idx]
  const description = `Replace "${oldText.slice(0, 40)}${oldText.length > 40 ? '…' : ''}"`
  const result = stageReplaceRange(editor, blockId, match.from, match.to, newText, description)
  if (!result.success) return result

  const charLength = found.node.textContent.length
  return {
    success: true,
    blockId,
    mode: 'patch',
    startOffset: occurrences.flatPositions[idx],
    endOffset: occurrences.flatPositions[idx] + oldText.length,
    charLength: charLength + newText.length - oldText.length
  }
}

function buildBlockJson(type: string, text: string): any {
  let nodeType = type
  let attrs = {}
  if (type.startsWith('heading')) {
    nodeType = 'heading'
    attrs = { level: parseInt(type.replace('heading', ''), 10) || 1 }
  }
  return {
    type: nodeType,
    ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
    content: text ? [{ type: 'text', text }] : []
  }
}

function executeInsertBlock(editor: Editor, args: Record<string, unknown>): unknown {
  const afterBlockId = args.afterBlockId as string
  const type = (args.type as string) || 'paragraph'
  const text = (args.text as string) || ''
  const description = deriveSuggestionDescription('insert_block', args)

  const newJson = buildBlockJson(type, text)
  return stageInsert(editor, afterBlockId, newJson, description)
}

function executeInsertList(editor: Editor, args: Record<string, unknown>): unknown {
  const afterBlockId = args.afterBlockId as string
  const listType = (args.listType as string) || 'bulletList'
  const items = (args.items as string[]) || []
  const description = deriveSuggestionDescription('insert_list', args)

  const newJson = {
    type: listType,
    content: items.map((text) => ({
      type: 'listItem',
      content: [
        {
          type: 'paragraph',
          content: text ? [{ type: 'text', text }] : []
        }
      ]
    }))
  }

  return stageInsert(editor, afterBlockId, newJson, description)
}

function executeDeleteBlocks(editor: Editor, args: Record<string, unknown>): unknown {
  const blockIds = (args.blockIds as string[]) ?? []
  const description = deriveSuggestionDescription('delete_blocks', args)

  const sorted = [...blockIds].sort((a, b) => {
    const posA = getBlockById(editor, a)?.pos ?? 0
    const posB = getBlockById(editor, b)?.pos ?? 0
    return posB - posA
  })

  return stageDelete(editor, sorted, description)
}

function applyFormattingToRange(
  editor: Editor,
  range: { from: number; to: number },
  formatting: Record<string, unknown>
): void {
  editor.chain().focus().setTextSelection(range).run()

  if (formatting.bold) editor.chain().focus().toggleBold().run()
  if (formatting.italic) editor.chain().focus().toggleItalic().run()
  if (formatting.underline) editor.chain().focus().toggleUnderline().run()
  if (formatting.strike) editor.chain().focus().toggleStrike().run()
  if (formatting.color) editor.chain().focus().setColor(formatting.color as string).run()
  if (formatting.fontFamily) editor.chain().focus().setFontFamily(formatting.fontFamily as string).run()
  if (formatting.fontSize) editor.chain().focus().setFontSize(formatting.fontSize as string).run()
  if (formatting.highlight !== undefined) {
    if (formatting.highlight === 'none' || !formatting.highlight) {
      editor.chain().focus().unsetHighlight().run()
    } else {
      editor.chain().focus().setHighlight({ color: formatting.highlight as string }).run()
    }
  }
}

function formatResultPayload(
  blockId: string,
  startOffset: number,
  endOffset: number,
  editor?: Editor
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

function executeFormatText(editor: Editor, args: Record<string, unknown>): unknown {
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

      const range = { from: content.from, to: content.to }
      const beforeContent = editor.state.doc.slice(range.from, range.to).toJSON()
      applyFormattingToRange(editor, range, formatting)
      stageFormatRange(editor, blockId, range.from, range.to, 'Format block', { beforeContent })
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

    const range = { from: resolved.from, to: resolved.to }
    const beforeContent = editor.state.doc.slice(range.from, range.to).toJSON()
    applyFormattingToRange(editor, range, formatting)
    stageFormatRange(editor, blockId, range.from, range.to, `Format range`, { beforeContent })

    return formatResultPayload(blockId, startOffset, endOffset, editor)
  }

  if (scope === 'run') {
    const runIndex = args.runIndex as number
    if (runIndex === undefined) return { error: 'scope "run" requires runIndex from read_blocks.' }

    const resolved = runIndexToRange(editor, blockId, runIndex)
    if ('error' in resolved) return { error: resolved.error }

    const range = { from: resolved.from, to: resolved.to }
    const beforeContent = editor.state.doc.slice(range.from, range.to).toJSON()
    applyFormattingToRange(editor, range, formatting)
    stageFormatRange(editor, blockId, range.from, range.to, `Format run ${runIndex}`, {
      beforeContent
    })

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
  const occurrences = findTextOccurrences(editor, blockId, searchText)
  if (!occurrences || occurrences.matches.length === 0) {
    return { error: `searchText not found in block ${blockId}. Re-read with read_blocks.` }
  }
  if (occurrences.matches.length > 1 && args.occurrence === undefined) {
    return {
      error: `searchText matches ${occurrences.matches.length} times. Pass occurrence (1-${occurrences.matches.length}) or use scope "range" with charStart/charEnd from read_blocks.`
    }
  }

  const idx = Math.max(1, occurrence) - 1
  if (idx >= occurrences.matches.length) {
    return { error: `occurrence ${occurrence} out of range (${occurrences.matches.length} matches).` }
  }

  const match = occurrences.matches[idx]
  const startOffset = occurrences.flatPositions[idx]
  const endOffset = startOffset + searchText.length
  const beforeContent = editor.state.doc.slice(match.from, match.to).toJSON()

  applyFormattingToRange(editor, match, formatting)
  stageFormatRange(editor, blockId, match.from, match.to, 'Format text', { beforeContent })

  return formatResultPayload(blockId, startOffset, endOffset, editor)
}

function applyBlockStyleAttrs(
  editor: Editor,
  blockId: string,
  blockStyle: Record<string, unknown>
): boolean {
  const found = getBlockById(editor, blockId)
  if (!found) return false

  const blockFrom = found.pos
  const blockTo = found.pos + found.node.nodeSize
  editor.chain().focus().setTextSelection({ from: blockFrom + 1, to: blockTo - 1 }).run()

  const chain = editor.chain().focus()
  if (blockStyle.textAlign) {
    chain.setTextAlign(blockStyle.textAlign as string)
  }
  if (blockStyle.lineSpacing) {
    chain.setLineSpacing(blockStyle.lineSpacing as string)
  }
  return chain.run()
}

function executeApplyStyle(editor: Editor, args: Record<string, unknown>): unknown {
  const blockId = args.blockId as string
  const style = args.style as string | undefined
  const blockStyle = args.blockStyle as Record<string, unknown> | undefined

  if (!blockId) return { error: 'blockId is required' }
  if (!style && !blockStyle) {
    return { error: 'Provide style and/or blockStyle (textAlign, lineSpacing).' }
  }

  const found = getBlockById(editor, blockId)
  if (!found) return { error: `Block ${blockId} not found` }

  const blockFrom = found.pos
  const blockTo = found.pos + found.node.nodeSize
  const beforeContent = editor.state.doc.slice(blockFrom, blockTo).toJSON()

  if (style) {
    editor.chain().focus().setTextSelection({ from: blockFrom + 1, to: blockTo - 1 }).run()

    switch (style) {
      case 'paragraph':
        editor.chain().focus().setParagraph().run()
        break
      case 'heading1':
        editor.chain().focus().toggleHeading({ level: 1 }).run()
        break
      case 'heading2':
        editor.chain().focus().toggleHeading({ level: 2 }).run()
        break
      case 'heading3':
        editor.chain().focus().toggleHeading({ level: 3 }).run()
        break
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run()
        break
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run()
        break
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run()
        break
      default:
        return { error: `Unknown style: ${style}` }
    }
  }

  if (blockStyle) {
    applyBlockStyleAttrs(editor, blockId, blockStyle)
  }

  const applied: Record<string, unknown> = { success: true, blockId }
  if (style) applied.applied = style
  else if (blockStyle) applied.applied = 'blockStyle'

  const charLength = getBlockCharLength(editor, blockId)
  if (charLength != null) applied.charLength = charLength

  const updated = getBlockById(editor, blockId)
  const highlightFrom = updated?.pos ?? blockFrom
  const highlightTo = updated ? updated.pos + updated.node.nodeSize : blockTo

  const descParts: string[] = []
  if (style) descParts.push(style)
  if (blockStyle?.textAlign) descParts.push(`align ${blockStyle.textAlign}`)
  if (blockStyle?.lineSpacing) descParts.push(`spacing ${blockStyle.lineSpacing}`)

  stageFormatRange(editor, blockId, highlightFrom, highlightTo, `Apply ${descParts.join(', ')}`, {
    beforeContent,
    type: 'style'
  })

  return applied
}

function executeInsertPageBreak(editor: Editor, args: Record<string, unknown>): unknown {
  const afterBlockId = args.afterBlockId as string
  return stageInsert(
    editor,
    afterBlockId,
    '<hr>',
    deriveSuggestionDescription('insert_page_break', args)
  )
}

function buildTableHtml(rows: number, cols: number): string {
  const headerCells = Array.from({ length: cols }, (_, i) => `<th>Header ${i + 1}</th>`).join('')
  const bodyRows = Array.from({ length: rows - 1 }, (_, r) => {
    const cells = Array.from({ length: cols }, (_, c) => `<td>Cell ${r + 1}-${c + 1}</td>`).join('')
    return `<tr>${cells}</tr>`
  }).join('')
  return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`
}

function executeInsertTable(editor: Editor, args: Record<string, unknown>): unknown {
  const afterBlockId = args.afterBlockId as string
  const rows = Math.max(1, (args.rows as number) ?? 3)
  const cols = Math.max(1, (args.cols as number) ?? 3)
  const description = deriveSuggestionDescription('insert_table', args)
  const html = buildTableHtml(rows, cols)
  return stageInsert(editor, afterBlockId, html, description)
}

function executeInsertImage(editor: Editor, args: Record<string, unknown>): unknown {
  const afterBlockId = args.afterBlockId as string
  const src = args.src as string
  const alt = (args.alt as string) ?? ''
  const description = deriveSuggestionDescription('insert_image', args)
  const html = `<img src="${src.replace(/"/g, '&quot;')}" alt="${alt.replace(/"/g, '&quot;')}" />`
  return stageInsert(editor, afterBlockId, html, description)
}

function executeSetPageSetup(editor: Editor, args: Record<string, unknown>): unknown {
  const pageSize = args.pageSize as string | undefined
  const orientation = args.orientation as string | undefined
  const margins = args.margins as
    | { top?: number; bottom?: number; left?: number; right?: number }
    | undefined

  const chain = editor.chain().focus()

  const size = resolvePageSize(pageSize)
  if (size) {
    let w = size.width
    let h = size.height
    if (orientation === 'landscape') {
      ;[w, h] = [h, w]
    }
    chain.updatePageWidth(w).updatePageHeight(h)
  } else if (orientation === 'landscape') {
    const letter = resolvePageSize('Letter')!
    chain.updatePageWidth(letter.height).updatePageHeight(letter.width)
  }

  if (margins) {
    chain.updateMargins({
      top: margins.top ? inchToPx(margins.top) : inchToPx(1),
      bottom: margins.bottom ? inchToPx(margins.bottom) : inchToPx(1),
      left: margins.left ? inchToPx(margins.left) : inchToPx(1),
      right: margins.right ? inchToPx(margins.right) : inchToPx(1)
    })
  }

  chain.run()
  return { success: true }
}

function executeSetPageNumbers(editor: Editor, args: Record<string, unknown>): unknown {
  const position = args.position as string
  const format = args.format as string

  const chain = editor.chain().focus()

  if (position.startsWith('footer')) {
    const side = position.replace('footer-', '')
    if (side === 'left' || side === 'center') {
      chain.updateFooterContent(format, '')
    } else {
      chain.updateFooterContent('', format)
    }
  } else if (position.startsWith('header')) {
    const side = position.replace('header-', '')
    if (side === 'left' || side === 'center') {
      chain.updateHeaderContent(format, '')
    } else {
      chain.updateHeaderContent('', format)
    }
  }

  chain.run()
  return { success: true }
}
