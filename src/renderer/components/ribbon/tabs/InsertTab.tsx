import type { WordCloneEditorRef } from '../../../editor/editorBridge'
import {
  insertPageBreak,
  collectParagraphSnapshots
} from '../../../editor/editorBridge'
import { stageInsert } from '../../../ai/suggestionService'
import RibbonGroup from '../RibbonGroup'
import RibbonButton from '../RibbonButton'
import {
  FilePlus,
  SeparatorHorizontal,
  Table,
  Image,
  Link,
  ExternalLink,
  FileText
} from 'lucide-react'

interface InsertTabProps {
  editor: WordCloneEditorRef | null
}

export default function InsertTab({ editor }: InsertTabProps) {
  const handlePageBreak = () => {
    insertPageBreak(editor)
  }

  const handleTable = () => {
    if (!editor) return
    const rows = parseInt(window.prompt('Number of rows:', '3') ?? '3', 10)
    const cols = parseInt(window.prompt('Number of columns:', '3') ?? '3', 10)
    if (!isNaN(rows) && !isNaN(cols) && rows > 0 && cols > 0) {
      const paras = collectParagraphSnapshots(editor)
      const lastId = paras[paras.length - 1]?.paraId ?? '__start__'
      const lines = [`[Table ${rows}x${cols}]`]
      for (let r = 0; r < rows; r++) {
        lines.push(Array.from({ length: cols }, (_, c) => `Cell ${r + 1}-${c + 1}`).join('\t'))
      }
      stageInsert(editor, lastId, lines.join('\n'), `Insert ${rows}x${cols} table`)
    }
  }

  const handleImage = () => {
    if (!editor) return
    const url = window.prompt('Image URL or base64 data URI:')
    if (url) {
      const alt = window.prompt('Alt text:') ?? ''
      const paras = collectParagraphSnapshots(editor)
      const lastId = paras[paras.length - 1]?.paraId ?? '__start__'
      stageInsert(editor, lastId, `[Image: ${alt || url}]`, 'Insert image')
    }
  }

  const handleLink = () => {
    if (!editor) return
    const info = editor.getSelectionInfo()
    const selectedText = info?.selectedText
    if (!selectedText) {
      alert('Select some text first to create a hyperlink.')
      return
    }
    const url = window.prompt('URL:')
    if (url) {
      editor.applyFormatting({ paraId: info.paraId!, search: selectedText, marks: { underline: true } })
    }
  }

  const handleBlankPage = () => {
    if (!editor) return
    const info = editor.getSelectionInfo()
    if (!info?.paraId) return
    editor.insertBreak({ paraId: info.paraId, type: 'sectionNextPage' })
  }

  return (
    <div className="flex h-full items-stretch">
      <RibbonGroup title="Pages">
        <RibbonButton
          icon={FilePlus}
          label="Cover Page"
          title="Cover Page (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Blank Page"
          title="Blank Page"
          onClick={handleBlankPage}
          disabled={!editor}
        />
        <RibbonButton
          icon={SeparatorHorizontal}
          label="Page Break"
          title="Page Break"
          onClick={handlePageBreak}
          disabled={!editor}
        />
      </RibbonGroup>

      <RibbonGroup title="Tables">
        <RibbonButton
          icon={Table}
          label="Table"
          title="Insert Table"
          onClick={handleTable}
          disabled={!editor}
        />
      </RibbonGroup>

      <RibbonGroup title="Illustrations">
        <RibbonButton
          icon={Image}
          label="Pictures"
          title="Insert Picture from File/URL"
          onClick={handleImage}
          disabled={!editor}
        />
        <RibbonButton
          icon={ExternalLink}
          label="Online Pictures"
          title="Online Pictures (Bing search not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Shapes"
          title="Shapes (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Icons"
          title="Icons (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="3D Models"
          title="3D Models (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="SmartArt"
          title="SmartArt (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Chart"
          title="Chart (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Screenshot"
          title="Screenshot (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Links">
        <RibbonButton
          icon={Link}
          label="Link"
          title="Hyperlink"
          onClick={handleLink}
          disabled={!editor}
        />
        <RibbonButton
          icon={ExternalLink}
          label="Bookmark"
          title="Bookmark (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Cross-reference"
          title="Cross-reference (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Header & Footer">
        <RibbonButton
          icon={FileText}
          label="Header"
          title="Edit Header (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Footer"
          title="Edit Footer (not implemented)"
          disabled
        />
        <RibbonButton
          icon={ExternalLink}
          label="Page Number"
          title="Page Number (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Text">
        <RibbonButton
          icon={FileText}
          label="Text Box"
          title="Text Box (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Quick Parts"
          title="Quick Parts (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="WordArt"
          title="WordArt (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Drop Cap"
          title="Drop Cap (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Signature Line"
          title="Signature Line (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Date & Time"
          title="Date & Time (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Object"
          title="Object (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Symbols">
        <RibbonButton
          icon={FileText}
          label="Equation"
          title="Equation (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Symbol"
          title="Symbol (not implemented)"
          disabled
        />
      </RibbonGroup>
    </div>
  )
}