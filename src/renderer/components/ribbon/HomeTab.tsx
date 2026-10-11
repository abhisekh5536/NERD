import { useState, useRef, useCallback } from 'react'
import type { WordCloneEditorRef } from '../../editor/editorBridge'
import {
  toggleMark,
  setFontFamily,
  setFontSize,
  setFontColor,
  setHighlight,
  setParagraphStyle,
  undo,
  redo
} from '../../editor/editorBridge'
import RibbonGroup from './RibbonGroup'
import RibbonButton from './RibbonButton'
import FontColorPickerMenu from './FontColorPickerMenu'
import HighlightPickerMenu from './HighlightPickerMenu'
import { DropdownAnchorContext } from './DropdownMenu'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Subscript,
  Superscript,
  Eraser,
  IndentIncrease,
  IndentDecrease,
  CaseLower,
  List,
  ListOrdered,
  PaintBucket,
  Highlighter
} from 'lucide-react'
import { FONT_FAMILIES, FONT_SIZES } from '../../lib/editorStyles'
import { useUiStore } from '../../store/uiStore'
import type { RibbonFormatState } from '../../editor/editorBridge'

interface HomeTabProps {
  editor: WordCloneEditorRef | null
  formatState: RibbonFormatState | null
}

export default function HomeTab({ editor, formatState }: HomeTabProps) {
  const openFindBar = useUiStore((s) => s.openFindBar)
  const state = formatState

  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false)
  const fontColorAnchorRef = useRef<HTMLDivElement>(null)
  const highlightAnchorRef = useRef<HTMLDivElement>(null)

  const handleClearFormatting = useCallback(() => {
    if (!editor) return
    const info = editor.getSelectionInfo()
    if (!info?.paraId) return
    editor.applyFormatting({
      paraId: info.paraId,
      search: info.selectedText || undefined,
      marks: {
        bold: false,
        italic: false,
        underline: false,
        strike: false,
        color: { rgb: '000000' },
        fontFamily: { ascii: 'Calibri', hAnsi: 'Calibri' },
        fontSize: 22
      }
    })
  }, [editor])

  return (
    <div className="flex h-full items-start gap-1 overflow-x-auto">
      <RibbonGroup title="Clipboard">
        <RibbonButton icon={Undo2} title="Undo (Ctrl+Z)" onClick={() => undo(editor)} disabled={!editor} />
        <RibbonButton icon={Redo2} title="Redo (Ctrl+Y)" onClick={() => redo(editor)} disabled={!editor} />
      </RibbonGroup>

      <RibbonGroup title="Font">
        <select
          className="h-7 max-w-[120px] rounded border border-ribbon-border bg-white px-1 text-[12px]"
          value={state?.fontFamily ?? 'Calibri'}
          onChange={(e) => setFontFamily(editor, e.target.value)}
          disabled={!editor}
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
        <select
          className="h-7 w-14 rounded border border-ribbon-border bg-white px-1 text-[12px]"
          value={parseInt(state?.fontSize ?? '11', 10) || 11}
          onChange={(e) => setFontSize(editor, Number(e.target.value))}
          disabled={!editor}
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <RibbonButton
          icon={Bold}
          title="Bold (Ctrl+B)"
          active={!!state?.bold}
          onClick={() => toggleMark(editor, 'bold', !!state?.bold)}
          disabled={!editor}
        />
        <RibbonButton
          icon={Italic}
          title="Italic (Ctrl+I)"
          active={!!state?.italic}
          onClick={() => toggleMark(editor, 'italic', !!state?.italic)}
          disabled={!editor}
        />
        <RibbonButton
          icon={Underline}
          title="Underline (Ctrl+U)"
          active={!!state?.underline}
          onClick={() => toggleMark(editor, 'underline', !!state?.underline)}
          disabled={!editor}
        />
        <RibbonButton
          icon={Strikethrough}
          title="Strikethrough"
          active={!!state?.strike}
          onClick={() => toggleMark(editor, 'strike', !!state?.strike)}
          disabled={!editor}
        />
        <RibbonButton
          icon={Subscript}
          title="Subscript"
          disabled={!editor}
        />
        <RibbonButton
          icon={Superscript}
          title="Superscript"
          disabled={!editor}
        />
        <RibbonButton
          icon={Eraser}
          title="Clear Formatting"
          onClick={handleClearFormatting}
          disabled={!editor}
        />
      </RibbonGroup>

      <RibbonGroup title="Paragraph">
        <RibbonButton icon={AlignLeft} title="Align Left" active={!!state?.alignLeft} disabled={!editor} />
        <RibbonButton icon={AlignCenter} title="Align Center" active={!!state?.alignCenter} disabled={!editor} />
        <RibbonButton icon={AlignRight} title="Align Right" active={!!state?.alignRight} disabled={!editor} />
        <RibbonButton icon={AlignJustify} title="Justify" active={!!state?.alignJustify} disabled={!editor} />
      </RibbonGroup>

      <RibbonGroup title="List">
        <RibbonButton icon={List} title="Bullet List" disabled={!editor} />
        <RibbonButton icon={ListOrdered} title="Numbered List" disabled={!editor} />
        <RibbonButton icon={IndentDecrease} title="Decrease Indent" disabled={!editor} />
        <RibbonButton icon={IndentIncrease} title="Increase Indent" disabled={!editor} />
      </RibbonGroup>

      <RibbonGroup title="Styles">
        <RibbonButton
          label="Normal"
          title="Normal"
          active={!!state?.paragraph}
          onClick={() => setParagraphStyle(editor, 'Normal')}
          disabled={!editor}
        />
        <RibbonButton
          label="H1"
          title="Heading 1"
          active={!!state?.h1}
          onClick={() => setParagraphStyle(editor, 'Heading1')}
          disabled={!editor}
        />
        <RibbonButton
          label="H2"
          title="Heading 2"
          active={!!state?.h2}
          onClick={() => setParagraphStyle(editor, 'Heading2')}
          disabled={!editor}
        />
        <RibbonButton
          label="H3"
          title="Heading 3"
          onClick={() => setParagraphStyle(editor, 'Heading3')}
          disabled={!editor}
        />
        <RibbonButton
          label="Quote"
          title="Blockquote"
          onClick={() => setParagraphStyle(editor, 'Quote')}
          disabled={!editor}
        />
      </RibbonGroup>

      <RibbonGroup title="Editing">
        <RibbonButton label="Find" title="Find (Ctrl+F)" onClick={() => openFindBar()} disabled={!editor} />
        <div className="relative" ref={fontColorAnchorRef}>
          <DropdownAnchorContext.Provider value={fontColorAnchorRef}>
            <RibbonButton
              icon={PaintBucket}
              title="Font Color"
              active={colorPickerOpen}
              onClick={() => setColorPickerOpen(!colorPickerOpen)}
              disabled={!editor}
            />
            {colorPickerOpen && (
              <FontColorPickerMenu
                open={colorPickerOpen}
                onClose={() => setColorPickerOpen(false)}
                selectedColor={null}
                onSelect={(color) => setFontColor(editor, color.replace('#', ''))}
              />
            )}
          </DropdownAnchorContext.Provider>
        </div>
        <div className="relative" ref={highlightAnchorRef}>
          <DropdownAnchorContext.Provider value={highlightAnchorRef}>
            <RibbonButton
              icon={Highlighter}
              title="Highlight"
              active={highlightPickerOpen}
              onClick={() => setHighlightPickerOpen(!highlightPickerOpen)}
              disabled={!editor}
            />
            {highlightPickerOpen && (
              <HighlightPickerMenu
                open={highlightPickerOpen}
                onClose={() => setHighlightPickerOpen(false)}
                selectedColor={null}
                onSelect={(color) => setHighlight(editor, color)}
                onClear={() => setHighlight(editor, 'none')}
              />
            )}
          </DropdownAnchorContext.Provider>
        </div>
        <RibbonButton icon={CaseLower} title="Change Case" disabled={!editor} />
      </RibbonGroup>
    </div>
  )
}
