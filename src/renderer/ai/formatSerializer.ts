import type { Mark, Node as PmNode } from '@tiptap/pm/model'

export interface InlineMarks {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  subscript?: boolean
  superscript?: boolean
  color?: string
  highlight?: string
  fontFamily?: string
  fontSize?: string
  link?: string
}

export interface FormattedRun {
  text: string
  marks?: InlineMarks
  /** 0-based start index in block flat text (when includeFormatting from read_blocks). */
  charStart?: number
  /** 0-based exclusive end index in block flat text. */
  charEnd?: number
}

export interface BlockStyle {
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  lineSpacing?: string
  paragraphShading?: string
  paragraphBorder?: string
  level?: number
}

export interface FormattedCell {
  text: string
  runs: FormattedRun[]
}

function marksEqual(a?: InlineMarks, b?: InlineMarks): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export function normalizeMarks(marks: readonly Mark[]): InlineMarks | undefined {
  const result: InlineMarks = {}

  for (const mark of marks) {
    switch (mark.type.name) {
      case 'bold':
        result.bold = true
        break
      case 'italic':
        result.italic = true
        break
      case 'underline':
        result.underline = true
        break
      case 'strike':
        result.strike = true
        break
      case 'subscript':
        result.subscript = true
        break
      case 'superscript':
        result.superscript = true
        break
      case 'textStyle': {
        const fontSize = mark.attrs.fontSize as string | null | undefined
        const fontFamily = mark.attrs.fontFamily as string | null | undefined
        if (fontSize) result.fontSize = fontSize
        if (fontFamily) result.fontFamily = fontFamily
        break
      }
      case 'highlight': {
        const color = mark.attrs.color as string | null | undefined
        if (color) result.highlight = color
        break
      }
      case 'link': {
        const href = mark.attrs.href as string | null | undefined
        if (href) result.link = href
        break
      }
      case 'color': {
        const color = mark.attrs.color as string | null | undefined
        if (color) result.color = color
        break
      }
      default:
        break
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}

export function mergeAdjacentRuns(runs: FormattedRun[]): FormattedRun[] {
  if (runs.length === 0) return runs

  const merged: FormattedRun[] = []
  for (const run of runs) {
    const prev = merged[merged.length - 1]
    if (prev && marksEqual(prev.marks, run.marks)) {
      prev.text += run.text
      if (run.charEnd != null) prev.charEnd = run.charEnd
      else if (prev.charStart != null) prev.charEnd = prev.charStart + prev.text.length
    } else {
      merged.push(run.marks ? { text: run.text, marks: run.marks } : { text: run.text })
    }
  }
  return merged
}

export function extractBlockStyle(node: PmNode): BlockStyle | undefined {
  const attrs = node.attrs as Record<string, unknown>
  const style: BlockStyle = {}

  const textAlign = attrs.textAlign as string | null | undefined
  if (textAlign && textAlign !== 'left') {
    style.textAlign = textAlign as BlockStyle['textAlign']
  }

  const lineSpacing = attrs.lineSpacing as string | null | undefined
  if (lineSpacing) style.lineSpacing = lineSpacing

  const paragraphShading = attrs.paragraphShading as string | null | undefined
  if (paragraphShading) style.paragraphShading = paragraphShading

  const paragraphBorder = attrs.paragraphBorder as string | null | undefined
  if (paragraphBorder) style.paragraphBorder = paragraphBorder

  if (node.type.name === 'heading') {
    const level = attrs.level as number | null | undefined
    if (level != null) style.level = level
  }

  return Object.keys(style).length > 0 ? style : undefined
}

/** Extract blockStyle from the first paragraph-like child when the block is a listItem. */
export function extractBlockStyleFromNode(node: PmNode): BlockStyle | undefined {
  if (node.type.name === 'paragraph' || node.type.name === 'heading') {
    return extractBlockStyle(node)
  }

  if (node.type.name === 'listItem') {
    let style: BlockStyle | undefined
    node.forEach((child) => {
      if (!style && (child.type.name === 'paragraph' || child.type.name === 'heading')) {
        style = extractBlockStyle(child)
      }
    })
    return style
  }

  return extractBlockStyle(node)
}

function attachCharOffsets(runs: FormattedRun[], base = 0): FormattedRun[] {
  let pos = base
  return runs.map((run) => {
    const charStart = pos
    const charEnd = pos + run.text.length
    pos = charEnd
    return { ...run, charStart, charEnd }
  })
}

export function serializeNodeRuns(node: PmNode): { text: string; runs: FormattedRun[] } {
  const runs: FormattedRun[] = []

  node.descendants((child) => {
    if (!child.isText) return
    const text = child.text ?? ''
    if (!text) return
    const marks = normalizeMarks(child.marks)
    runs.push(marks ? { text, marks } : { text })
  })

  const merged = mergeAdjacentRuns(runs)
  const withOffsets = attachCharOffsets(merged)
  const text = withOffsets.map((r) => r.text).join('')
  return { text, runs: withOffsets }
}

export function serializeBlockRuns(node: PmNode): { text: string; runs: FormattedRun[] } {
  return serializeNodeRuns(node)
}

export function serializeTableRowsFormatted(node: PmNode): FormattedCell[][] {
  const rows: FormattedCell[][] = []
  node.forEach((row) => {
    if (row.type.name !== 'tableRow') return
    const cells: FormattedCell[] = []
    row.forEach((cell) => {
      cells.push(serializeNodeRuns(cell))
    })
    if (cells.length > 0) rows.push(cells)
  })
  return rows
}

export function truncateRuns(
  runs: FormattedRun[],
  textOffset: number,
  maxChars: number
): { runs: FormattedRun[]; text: string; truncated: boolean; totalChars: number } {
  const totalChars = runs.reduce((sum, r) => sum + r.text.length, 0)
  if (totalChars === 0) {
    return { runs: [], text: '', truncated: false, totalChars: 0 }
  }

  const start = Math.max(0, textOffset)
  const end = Math.min(totalChars, start + maxChars)
  const truncated = end < totalChars

  if (start >= totalChars) {
    return { runs: [], text: '', truncated: true, totalChars }
  }

  const sliced: FormattedRun[] = []
  let pos = 0

  for (const run of runs) {
    const runStart = pos
    const runEnd = pos + run.text.length
    pos = runEnd

    if (runEnd <= start || runStart >= end) continue

    const sliceStart = Math.max(0, start - runStart)
    const sliceEnd = Math.min(run.text.length, end - runStart)
    const text = run.text.slice(sliceStart, sliceEnd)
    if (!text) continue

    sliced.push(run.marks ? { text, marks: run.marks } : { text })
  }

  const merged = mergeAdjacentRuns(sliced)
  const withOffsets = attachCharOffsets(merged, start)
  const text = withOffsets.map((r) => r.text).join('')
  return { runs: withOffsets, text, truncated, totalChars }
}

/** Serialize runs for a document range (used by read_selection). */
export function serializeRangeRuns(doc: PmNode, from: number, to: number): { text: string; runs: FormattedRun[] } {
  const runs: FormattedRun[] = []

  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return
    const nodeStart = pos
    void (pos + node.nodeSize)
    const sliceStart = Math.max(0, from - nodeStart)
    const sliceEnd = Math.min(node.nodeSize, to - nodeStart)
    if (sliceStart >= sliceEnd) return

    const fullText = node.text ?? ''
    const text = fullText.slice(sliceStart, sliceEnd)
    if (!text) return

    const marks = normalizeMarks(node.marks)
    runs.push(marks ? { text, marks } : { text })
  })

  const merged = mergeAdjacentRuns(runs)
  const text = merged.map((r) => r.text).join('')
  return { text, runs: merged }
}
