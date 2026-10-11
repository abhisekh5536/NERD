import { forwardRef, useImperativeHandle, useRef } from 'react'
import { DocxEditor, type DocxEditorRef } from '@eigenpal/docx-editor-react'
import type { Document } from '@eigenpal/docx-editor-core/types/document'
import type { SelectionState } from '@eigenpal/docx-editor-core/prosemirror'
import '@eigenpal/docx-editor-react/styles.css'

export type { DocxEditorRef as WordCloneEditorRef }

export interface DocxWordEditorProps {
  documentBuffer?: ArrayBuffer | null
  document?: Document | null
  onDirty: () => void
  onSelectionChange?: (state: SelectionState | null) => void
  onReady?: () => void
}

export const DocxWordEditor = forwardRef<DocxEditorRef, DocxWordEditorProps>(
  ({ documentBuffer, document, onDirty, onSelectionChange, onReady }, ref) => {
    const innerRef = useRef<DocxEditorRef>(null)
    useImperativeHandle(ref, () => innerRef.current!)

    return (
      <div className="wordclone-editor h-full min-h-0 flex-1">
        <DocxEditor
          ref={innerRef}
          documentBuffer={documentBuffer}
          document={document}
          mode="editing"
          showToolbar={false}
          showRuler={false}
          showZoomControl={false}
          showFileOpen={false}
          showHelpMenu={false}
          showOutline={false}
          showOutlineButton={false}
          disableFindReplaceShortcuts
          className="h-full"
          onChange={onDirty}
          onSelectionChange={onSelectionChange}
          onFontsLoaded={onReady}
        />
      </div>
    )
  }
)

DocxWordEditor.displayName = 'DocxWordEditor'

export default DocxWordEditor
