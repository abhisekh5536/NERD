import type { DocxEditorRef } from '@eigenpal/docx-editor-react'
import type { SelectionState } from '@eigenpal/docx-editor-core/prosemirror'

export type WordCloneEditorRef = DocxEditorRef

export function getEditorRef(ref: { current: WordCloneEditorRef | null }): WordCloneEditorRef | null {
  return ref.current
}

export type RibbonFormatState = {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  fontFamily: string
  fontSize: string
  highlight: boolean
  alignLeft: boolean
  alignCenter: boolean
  alignRight: boolean
  alignJustify: boolean
  paragraph: boolean
  h1: boolean
  h2: boolean
}

export function selectionToRibbonState(selection: SelectionState | null): RibbonFormatState | null {
  if (!selection) return null
  const fmt = selection.textFormatting ?? {}
  const para = selection.paragraphFormatting ?? {}
  const styleId = selection.styleId ?? ''
  const fontFamily = fmt.fontFamily?.ascii ?? fmt.fontFamily?.hAnsi ?? 'Calibri'
  const fontSizePt = fmt.fontSize != null ? fmt.fontSize / 2 : 11
  return {
    bold: !!fmt.bold,
    italic: !!fmt.italic,
    underline: !!fmt.underline,
    strike: !!fmt.strike,
    fontFamily,
    fontSize: `${fontSizePt}pt`,
    highlight: !!fmt.highlight,
    alignLeft: para.alignment === 'left' || !para.alignment,
    alignCenter: para.alignment === 'center',
    alignRight: para.alignment === 'right',
    alignJustify: para.alignment === 'both' || para.alignment === 'distribute',
    paragraph: !styleId || styleId === 'Normal',
    h1: styleId === 'Heading1' || styleId === 'heading1',
    h2: styleId === 'Heading2' || styleId === 'heading2'
  }
}

export function requireParaId(editor: WordCloneEditorRef | null): string | null {
  return editor?.getSelectionInfo()?.paraId ?? null
}

export function toggleMark(
  editor: WordCloneEditorRef | null,
  mark: 'bold' | 'italic' | 'underline' | 'strike',
  active: boolean
): void {
  if (!editor) return
  const info = editor.getSelectionInfo()
  if (!info?.paraId) return
  editor.applyFormatting({
    paraId: info.paraId,
    search: info.selectedText || undefined,
    marks: { [mark]: !active }
  })
}

export function setFontFamily(editor: WordCloneEditorRef | null, family: string): void {
  if (!editor) return
  const info = editor.getSelectionInfo()
  if (!info?.paraId) return
  editor.applyFormatting({
    paraId: info.paraId,
    search: info.selectedText || undefined,
    marks: { fontFamily: { ascii: family, hAnsi: family } }
  })
}

export function setFontSize(editor: WordCloneEditorRef | null, sizePt: number): void {
  if (!editor) return
  const info = editor.getSelectionInfo()
  if (!info?.paraId) return
  editor.applyFormatting({
    paraId: info.paraId,
    search: info.selectedText || undefined,
    marks: { fontSize: sizePt * 2 }
  })
}

export function setFontColor(editor: WordCloneEditorRef | null, rgb: string): void {
  if (!editor) return
  const info = editor.getSelectionInfo()
  if (!info?.paraId) return
  editor.applyFormatting({
    paraId: info.paraId,
    search: info.selectedText || undefined,
    marks: { color: { rgb } }
  })
}

export function setHighlight(editor: WordCloneEditorRef | null, color: string): void {
  if (!editor) return
  const info = editor.getSelectionInfo()
  if (!info?.paraId) return
  editor.applyFormatting({
    paraId: info.paraId,
    search: info.selectedText || undefined,
    marks: { highlight: color }
  })
}

export function setParagraphStyle(editor: WordCloneEditorRef | null, styleId: string): void {
  if (!editor) return
  const info = editor.getSelectionInfo()
  if (!info?.paraId) return
  editor.setParagraphStyle({ paraId: info.paraId, styleId })
}

export function undo(editor: WordCloneEditorRef | null): void {
  editor?.getEditorRef()?.undo()
}

export function redo(editor: WordCloneEditorRef | null): void {
  editor?.getEditorRef()?.redo()
}

export async function saveEditorBuffer(editor: WordCloneEditorRef | null): Promise<ArrayBuffer | null> {
  if (!editor) return null
  return editor.save()
}

export function getPageCount(editor: WordCloneEditorRef | null): number {
  if (!editor) return 1
  try {
    return Math.max(1, editor.getTotalPages())
  } catch {
    return 1
  }
}

/** Read the live ProseMirror document — safe while paginated layout is stale. */
function getPmDoc(editor: WordCloneEditorRef | null) {
  if (!editor) return null
  try {
    return editor.getEditorRef()?.getState()?.doc ?? null
  } catch {
    return null
  }
}

export type ParagraphSnapshot = {
  paraId: string
  text: string
  styleId?: string
  nodeType: string
}

/** Collect paragraphs from PM state (does not depend on paginated layout positions). */
export function collectParagraphSnapshots(editor: WordCloneEditorRef | null): ParagraphSnapshot[] {
  const doc = getPmDoc(editor)
  if (doc) {
    const snapshots: ParagraphSnapshot[] = []
    doc.descendants((node) => {
      const name = node.type.name
      if (name !== 'paragraph' && name !== 'heading') return
      const paraId = node.attrs.paraId as string | undefined
      if (!paraId) return
      snapshots.push({
        paraId,
        text: node.textContent,
        styleId: node.attrs.styleId as string | undefined,
        nodeType: name
      })
    })
    if (snapshots.length > 0) return snapshots
  }

  return collectParagraphSnapshotsViaPages(editor)
}

function collectParagraphSnapshotsViaPages(editor: WordCloneEditorRef | null): ParagraphSnapshot[] {
  if (!editor) return []
  const snapshots: ParagraphSnapshot[] = []
  try {
    const pages = editor.getTotalPages()
    for (let page = 1; page <= pages; page++) {
      try {
        const content = editor.getPageContent(page)
        if (!content) continue
        for (const para of content.paragraphs) {
          snapshots.push({
            paraId: para.paraId,
            text: para.text,
            styleId: para.styleId,
            nodeType: 'paragraph'
          })
        }
      } catch {
        // Layout can be briefly stale after bulk track-change accept/reject.
      }
    }
  } catch {
    /* ignore */
  }
  return snapshots
}

export function findParagraphSnapshot(
  editor: WordCloneEditorRef | null,
  paraId: string
): ParagraphSnapshot | null {
  return collectParagraphSnapshots(editor).find((p) => p.paraId === paraId) ?? null
}

export function getPlainText(editor: WordCloneEditorRef | null): string {
  const doc = getPmDoc(editor)
  if (doc) {
    try {
      return doc.textBetween(0, doc.content.size, '\n\n')
    } catch {
      try {
        return doc.textContent
      } catch {
        /* fall through */
      }
    }
  }
  try {
    return editor?.getAgent()?.getText() ?? ''
  } catch {
    return ''
  }
}

export function insertPageBreak(editor: WordCloneEditorRef | null): boolean {
  if (!editor) return false
  const info = editor.getSelectionInfo()
  if (!info?.paraId) return false
  return editor.insertBreak({ paraId: info.paraId, type: 'page' })
}

export function insertSectionBreak(editor: WordCloneEditorRef | null): boolean {
  if (!editor) return false
  const info = editor.getSelectionInfo()
  if (!info?.paraId) return false
  return editor.insertBreak({ paraId: info.paraId, type: 'sectionNextPage' })
}
