import type { WordCloneEditorRef } from '../../../editor/editorBridge'
import { insertPageBreak, insertSectionBreak } from '../../../editor/editorBridge'
import RibbonGroup from '../RibbonGroup'
import RibbonButton from '../RibbonButton'
import {
  Settings,
  Square,
  FileText,
  SeparatorHorizontal,
  Printer,
  Columns2,
  Indent,
  Ruler
} from 'lucide-react'

interface LayoutTabProps {
  editor: WordCloneEditorRef | null
}

export default function LayoutTab({ editor }: LayoutTabProps) {

  return (
    <div className="flex h-full items-stretch">
      <RibbonGroup title="Page Setup">
        <RibbonButton
          icon={Settings}
          label="Margins"
          title="Page Margins (not implemented)"
          disabled
        />
        <RibbonButton
          icon={Square}
          label="Orientation"
          title="Toggle Orientation (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Size"
          title="Page Size (not implemented)"
          disabled
        />
        <RibbonButton
          icon={SeparatorHorizontal}
          label="Page Break"
          title="Insert Page Break"
          onClick={() => insertPageBreak(editor)}
          disabled={!editor}
        />
        <RibbonButton
          icon={SeparatorHorizontal}
          label="Section Break"
          title="Insert Section Break"
          onClick={() => insertSectionBreak(editor)}
          disabled={!editor}
        />
        <RibbonButton
          icon={Columns2}
          label="Columns"
          title="Columns (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Paragraph">
        <RibbonButton
          icon={Indent}
          label="Indent"
          title="Indent (not implemented)"
          disabled
        />
        <RibbonButton
          icon={Ruler}
          label="Spacing"
          title="Line Spacing (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Page Background">
        <RibbonButton
          icon={FileText}
          label="Watermark"
          title="Watermark (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Page Color"
          title="Page Color (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Page Borders"
          title="Page Borders (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Arrange">
        <RibbonButton
          icon={FileText}
          label="Position"
          title="Position (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Wrap Text"
          title="Wrap Text (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Align"
          title="Align (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Group"
          title="Group (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Rotate"
          title="Rotate (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Print">
        <RibbonButton
          icon={Printer}
          label="Print"
          title="Print Document"
          onClick={() => editor?.print()}
          disabled={!editor}
        />
      </RibbonGroup>
    </div>
  )
}