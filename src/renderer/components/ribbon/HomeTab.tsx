import { useMemo, useRef, useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import type { ChainedCommands } from '@tiptap/core'
import {
  AArrowDown,
  AArrowUp,
  ALargeSmall,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowUpAZ,
  Baseline,
  Bold,
  ClipboardPaste,
  Copy,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  ListTree,
  PaintBucket,
  Paintbrush,
  Pilcrow,
  RemoveFormatting,
  Replace,
  Rows3,
  Scissors,
  Search,
  Square,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  WholeWord
} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import RibbonGroup from './RibbonGroup'
import RibbonButton from './RibbonButton'
import FontColorPickerMenu from './FontColorPickerMenu'
import HighlightPickerMenu from './HighlightPickerMenu'
import DropdownMenu, { MenuTrigger, type DropdownItem } from './DropdownMenu'
import StyleGallery from './StyleGallery'
import { FONT_FAMILIES, FONT_SIZES } from '../../lib/editorStyles'

const LINE_SPACINGS = ['1', '1.15', '1.5', '2', '2.5', '3']

type OpenMenu =
  | 'changeCase'
  | 'fontColor'
  | 'highlightColor'
  | 'bullets'
  | 'numbering'
  | 'multilevel'
  | 'lineSpacing'
  | 'shading'
  | 'borders'
  | 'select'

interface PainterSnapshot {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  subscript: boolean
  superscript: boolean
  fontFamily: string
  fontSize: string
  color: string
  highlightColor: string | null
}

function toSentenceCase(input: string): string {
  const lower = input.toLowerCase()
  return lower.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (match) => match.toUpperCase())
}

function toToggleCase(input: string): string {
  return input
    .split('')
    .map((char) => {
      const upper = char.toUpperCase()
      const lower = char.toLowerCase()
      if (char === upper) return lower
      if (char === lower) return upper
      return char
    })
    .join('')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function HomeTab({ editor }: { editor: Editor | null }) {
  const showParagraphMarks = useUiStore((s) => s.showParagraphMarks)
  const toggleParagraphMarks = useUiStore((s) => s.toggleParagraphMarks)
  const formatPainterActive = useUiStore((s) => s.formatPainterActive)
  const setFormatPainterActive = useUiStore((s) => s.setFormatPainterActive)
  const openFindBar = useUiStore((s) => s.openFindBar)

  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null)
  const painterSnapshotRef = useRef<PainterSnapshot | null>(null)

  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null
      const textStyle = editor.getAttributes('textStyle')
      const highlight = editor.getAttributes('highlight')
      const paragraphAttrs = editor.isActive('heading')
        ? editor.getAttributes('heading')
        : editor.getAttributes('paragraph')
      return {
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        subscript: editor.isActive('subscript'),
        superscript: editor.isActive('superscript'),
        highlight: editor.isActive('highlight'),
        bulletList: editor.isActive('bulletList'),
        orderedList: editor.isActive('orderedList'),
        alignLeft: editor.isActive({ textAlign: 'left' }),
        alignCenter: editor.isActive({ textAlign: 'center' }),
        alignRight: editor.isActive({ textAlign: 'right' }),
        alignJustify: editor.isActive({ textAlign: 'justify' }),
        paragraph: editor.isActive('paragraph'),
        h1: editor.isActive('heading', { level: 1 }),
        h2: editor.isActive('heading', { level: 2 }),
        fontFamily: (textStyle.fontFamily as string | undefined) ?? '',
        fontSize: String(textStyle.fontSize ?? '').replace('pt', ''),
        fontColor: (textStyle.color as string | undefined) ?? '#000000',
        highlightColor: (highlight.color as string | undefined) ?? '#fff200',
        lineSpacing: (paragraphAttrs.lineSpacing as string | undefined) ?? '1.15',
        paragraphShading: (paragraphAttrs.paragraphShading as string | undefined) ?? '#ffffff',
        paragraphBorder: Boolean(paragraphAttrs.paragraphBorder)
      }
    }
  })

  const cmd =
    (fn: (chain: ChainedCommands) => ChainedCommands) =>
    (): void => {
      if (!editor) return
      fn(editor.chain().focus()).run()
    }

  const toggleMenu = (menu: OpenMenu): void => {
    setOpenMenu((prev) => (prev === menu ? null : menu))
  }

  const onClipboard = (action: 'cut' | 'copy' | 'paste'): void => {
    if (!editor) return
    editor.chain().focus().run()
    if (action === 'paste') {
      navigator.clipboard
        .readText()
        .then((text) => editor.commands.insertContent(text))
        .catch(() => undefined)
      return
    }
    document.execCommand(action)
  }

  const applyFontSizeStep = (direction: 1 | -1): void => {
    if (!editor) return
    const current = Number(state?.fontSize || '11')
    const sizes = FONT_SIZES.map(Number)

    const next =
      direction > 0
        ? sizes.find((size) => size > current) ?? sizes[sizes.length - 1]!
        : [...sizes].reverse().find((size) => size < current) ?? sizes[0]!

    editor.chain().focus().setFontSize(`${next}pt`).run()
  }

  const applyCaseTransform = (transform: (value: string) => string): void => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    if (empty) return
    const selected = editor.state.doc.textBetween(from, to, ' ')
    editor.chain().focus().insertContentAt({ from, to }, transform(selected)).run()
  }

  const sortSelectionAlphabetically = (): void => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    if (empty) return
    const selected = editor.state.doc.textBetween(from, to, '\n')
    const lines = selected
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length < 2) return
    const sortedHtml = [...lines]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('')
    editor.chain().focus().insertContentAt({ from, to }, sortedHtml).run()
  }

  const onFormatPainter = (): void => {
    if (!editor) return

    if (!formatPainterActive) {
      const textStyle = editor.getAttributes('textStyle')
      const highlight = editor.getAttributes('highlight')
      painterSnapshotRef.current = {
        bold: Boolean(state?.bold),
        italic: Boolean(state?.italic),
        underline: Boolean(state?.underline),
        strike: Boolean(state?.strike),
        subscript: Boolean(state?.subscript),
        superscript: Boolean(state?.superscript),
        fontFamily: (textStyle.fontFamily as string | undefined) ?? '',
        fontSize: (textStyle.fontSize as string | undefined) ?? '',
        color: (textStyle.color as string | undefined) ?? '',
        highlightColor: (highlight.color as string | undefined) ?? null
      }
      setFormatPainterActive(true)
      return
    }

    const snapshot = painterSnapshotRef.current
    if (!snapshot) {
      setFormatPainterActive(false)
      return
    }

    let chain = editor.chain().focus()
    chain = snapshot.bold ? chain.setBold() : chain.unsetBold()
    chain = snapshot.italic ? chain.setItalic() : chain.unsetItalic()
    chain = snapshot.underline ? chain.setUnderline() : chain.unsetUnderline()
    chain = snapshot.strike ? chain.setStrike() : chain.unsetStrike()

    if (snapshot.subscript) {
      chain = chain.unsetSuperscript().setSubscript()
    } else if (snapshot.superscript) {
      chain = chain.unsetSubscript().setSuperscript()
    } else {
      chain = chain.unsetSubscript().unsetSuperscript()
    }

    if (snapshot.fontFamily) chain = chain.setFontFamily(snapshot.fontFamily)
    if (snapshot.fontSize) chain = chain.setFontSize(snapshot.fontSize)
    if (snapshot.color) chain = chain.setColor(snapshot.color)
    if (snapshot.highlightColor) {
      chain = chain.setHighlight({ color: snapshot.highlightColor })
    } else {
      chain = chain.unsetHighlight()
    }

    chain.run()
    setFormatPainterActive(false)
  }

  const changeCaseItems = useMemo<DropdownItem[]>(
    () => [
      {
        id: 'sentence',
        label: 'Sentence case',
        onSelect: () => applyCaseTransform(toSentenceCase)
      },
      {
        id: 'lower',
        label: 'lowercase',
        onSelect: () => applyCaseTransform((value) => value.toLowerCase())
      },
      {
        id: 'upper',
        label: 'UPPERCASE',
        onSelect: () => applyCaseTransform((value) => value.toUpperCase())
      },
      {
        id: 'capitalize',
        label: 'Capitalize Each Word',
        onSelect: () =>
          applyCaseTransform((value) =>
            value.replace(/\b\w/g, (char) => char.toUpperCase())
          )
      },
      {
        id: 'toggle',
        label: 'tOGGLE cASE',
        onSelect: () => applyCaseTransform(toToggleCase)
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor]
  )

  const selectClass =
    'app-no-drag h-7 rounded-[3px] border border-ribbon-border bg-white px-1 text-[12px] ' +
    'outline-none focus:border-word-accent disabled:opacity-40'

  const disabled = !editor

  return (
    <div className="flex h-full items-stretch overflow-visible">
      <RibbonGroup title="Clipboard">
        <RibbonButton
          icon={ClipboardPaste}
          label="Paste"
          variant="large"
          disabled={disabled}
          onClick={() => onClipboard('paste')}
        />
        <div className="flex flex-col justify-center">
          <RibbonButton icon={Scissors} title="Cut" disabled={disabled} onClick={() => onClipboard('cut')} />
          <RibbonButton icon={Copy} title="Copy" disabled={disabled} onClick={() => onClipboard('copy')} />
          <RibbonButton
            icon={Paintbrush}
            title="Format Painter"
            disabled={disabled}
            active={formatPainterActive}
            onClick={onFormatPainter}
          />
        </div>
      </RibbonGroup>

      <RibbonGroup title="Font">
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <select
              className={`${selectClass} w-[132px]`}
              title="Font"
              disabled={disabled}
              value={state?.fontFamily ?? ''}
              onChange={(e) => {
                if (!editor) return
                const value = e.target.value
                if (value) editor.chain().focus().setFontFamily(value).run()
                else editor.chain().focus().unsetFontFamily().run()
              }}
            >
              <option value="">(Default) Calibri</option>
              {FONT_FAMILIES.map((font) => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
            <select
              className={`${selectClass} w-[52px]`}
              title="Font Size"
              disabled={disabled}
              value={state?.fontSize ?? ''}
              onChange={(e) => {
                if (!editor) return
                const value = e.target.value
                if (value) editor.chain().focus().setFontSize(`${value}pt`).run()
                else editor.chain().focus().unsetFontSize().run()
              }}
            >
              <option value="">11</option>
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <RibbonButton
              icon={AArrowUp}
              title="Grow Font"
              disabled={disabled}
              onClick={() => applyFontSizeStep(1)}
            />
            <RibbonButton
              icon={AArrowDown}
              title="Shrink Font"
              disabled={disabled}
              onClick={() => applyFontSizeStep(-1)}
            />
            <MenuTrigger open={openMenu === 'changeCase'}>
              <RibbonButton
                icon={ALargeSmall}
                title="Change Case"
                variant="dropdown"
                disabled={disabled}
                onClick={() => toggleMenu('changeCase')}
              />
              <DropdownMenu
                open={openMenu === 'changeCase'}
                onClose={() => setOpenMenu(null)}
                items={changeCaseItems}
                minWidthClassName="min-w-[200px]"
              />
            </MenuTrigger>
            <RibbonButton
              icon={RemoveFormatting}
              title="Clear All Formatting"
              disabled={disabled}
              onClick={cmd((c) => c.unsetAllMarks().clearNodes())}
            />
          </div>
          <div className="flex items-center gap-0.5">
            <RibbonButton
              icon={Bold}
              title="Bold (Ctrl+B)"
              active={state?.bold}
              disabled={disabled}
              onClick={cmd((c) => c.toggleBold())}
            />
            <RibbonButton
              icon={Italic}
              title="Italic (Ctrl+I)"
              active={state?.italic}
              disabled={disabled}
              onClick={cmd((c) => c.toggleItalic())}
            />
            <RibbonButton
              icon={Underline}
              title="Underline (Ctrl+U)"
              active={state?.underline}
              disabled={disabled}
              onClick={cmd((c) => c.toggleUnderline())}
            />
            <RibbonButton
              icon={Strikethrough}
              title="Strikethrough"
              active={state?.strike}
              disabled={disabled}
              onClick={cmd((c) => c.toggleStrike())}
            />
            <RibbonButton
              icon={Subscript}
              title="Subscript"
              active={state?.subscript}
              disabled={disabled}
              onClick={() => {
                if (!editor) return
                if (editor.isActive('subscript')) {
                  editor.chain().focus().unsetSubscript().run()
                } else {
                  editor.chain().focus().unsetSuperscript().setSubscript().run()
                }
              }}
            />
            <RibbonButton
              icon={Superscript}
              title="Superscript"
              active={state?.superscript}
              disabled={disabled}
              onClick={() => {
                if (!editor) return
                if (editor.isActive('superscript')) {
                  editor.chain().focus().unsetSuperscript().run()
                } else {
                  editor.chain().focus().unsetSubscript().setSuperscript().run()
                }
              }}
            />
            <RibbonButton icon={WholeWord} title="Text Effects" disabled />
            <MenuTrigger open={openMenu === 'highlightColor'}>
              <RibbonButton
                icon={Highlighter}
                title="Text Highlight Color"
                variant="dropdown"
                disabled={disabled}
                active={state?.highlight}
                colorIndicator={state?.highlightColor}
                onClick={() => toggleMenu('highlightColor')}
              />
              <HighlightPickerMenu
                open={openMenu === 'highlightColor'}
                onClose={() => setOpenMenu(null)}
                selectedColor={state?.highlightColor}
                onSelect={(color) => editor?.chain().focus().setHighlight({ color }).run()}
                onClear={() => editor?.chain().focus().unsetHighlight().run()}
              />
            </MenuTrigger>
            <MenuTrigger open={openMenu === 'fontColor'}>
              <RibbonButton
                icon={Baseline}
                title="Font Color"
                variant="dropdown"
                disabled={disabled}
                colorIndicator={state?.fontColor}
                onClick={() => toggleMenu('fontColor')}
              />
              <FontColorPickerMenu
                open={openMenu === 'fontColor'}
                onClose={() => setOpenMenu(null)}
                selectedColor={state?.fontColor}
                onSelect={(color) => editor?.chain().focus().setColor(color).run()}
              />
            </MenuTrigger>
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup title="Paragraph">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-0.5">
            <MenuTrigger open={openMenu === 'bullets'}>
              <RibbonButton
                icon={List}
                title="Bullets"
                active={state?.bulletList}
                variant="dropdown"
                disabled={disabled}
                onClick={() => toggleMenu('bullets')}
              />
              <DropdownMenu
                open={openMenu === 'bullets'}
                onClose={() => setOpenMenu(null)}
                items={[
                  {
                    id: 'bullets-default',
                    label: 'Standard Bullets',
                    onSelect: () => {
                      if (!editor) return
                      if (!editor.isActive('bulletList')) {
                        editor.chain().focus().toggleBulletList().run()
                      }
                    }
                  },
                  {
                    id: 'bullets-circle',
                    label: 'Circle Bullets',
                    onSelect: () => {
                      if (!editor) return
                      if (!editor.isActive('bulletList')) {
                        editor.chain().focus().toggleBulletList().run()
                      }
                    }
                  }
                ]}
                minWidthClassName="min-w-[170px]"
              />
            </MenuTrigger>
            <MenuTrigger open={openMenu === 'numbering'}>
              <RibbonButton
                icon={ListOrdered}
                title="Numbering"
                active={state?.orderedList}
                variant="dropdown"
                disabled={disabled}
                onClick={() => toggleMenu('numbering')}
              />
              <DropdownMenu
                open={openMenu === 'numbering'}
                onClose={() => setOpenMenu(null)}
                items={[
                  {
                    id: 'num-default',
                    label: '1. 2. 3.',
                    onSelect: () => {
                      if (!editor) return
                      if (!editor.isActive('orderedList')) {
                        editor.chain().focus().toggleOrderedList().run()
                      }
                    }
                  },
                  {
                    id: 'num-alpha',
                    label: 'A. B. C.',
                    onSelect: () => {
                      if (!editor) return
                      if (!editor.isActive('orderedList')) {
                        editor.chain().focus().toggleOrderedList().run()
                      }
                    }
                  }
                ]}
                minWidthClassName="min-w-[140px]"
              />
            </MenuTrigger>
            <MenuTrigger open={openMenu === 'multilevel'}>
              <RibbonButton
                icon={ListTree}
                title="Multilevel List"
                variant="dropdown"
                disabled={disabled}
                onClick={() => toggleMenu('multilevel')}
              />
              <DropdownMenu
                open={openMenu === 'multilevel'}
                onClose={() => setOpenMenu(null)}
                items={[
                  {
                    id: 'multi-default',
                    label: 'Multilevel List',
                    onSelect: () => {
                      if (!editor) return
                      if (!editor.isActive('orderedList')) {
                        editor.chain().focus().toggleOrderedList().run()
                      }
                    }
                  },
                  {
                    id: 'multi-indent',
                    label: 'Increase List Level',
                    onSelect: () => {
                      if (!editor) return
                      editor.chain().focus().sinkListItem('listItem').run()
                    }
                  }
                ]}
                minWidthClassName="min-w-[180px]"
              />
            </MenuTrigger>
            <RibbonButton
              icon={IndentDecrease}
              title="Decrease Indent"
              disabled={disabled}
              onClick={cmd((c) => c.liftListItem('listItem'))}
            />
            <RibbonButton
              icon={IndentIncrease}
              title="Increase Indent"
              disabled={disabled}
              onClick={cmd((c) => c.sinkListItem('listItem'))}
            />
            <RibbonButton
              icon={ArrowUpAZ}
              title="Sort"
              disabled={disabled}
              onClick={sortSelectionAlphabetically}
            />
            <RibbonButton
              icon={Pilcrow}
              title="Show/Hide Paragraph Marks"
              disabled={disabled}
              active={showParagraphMarks}
              onClick={toggleParagraphMarks}
            />
          </div>
          <div className="flex items-center gap-0.5">
            <RibbonButton
              icon={AlignLeft}
              title="Align Left (Ctrl+L)"
              active={state?.alignLeft}
              disabled={disabled}
              onClick={cmd((c) => c.setTextAlign('left'))}
            />
            <RibbonButton
              icon={AlignCenter}
              title="Center (Ctrl+E)"
              active={state?.alignCenter}
              disabled={disabled}
              onClick={cmd((c) => c.setTextAlign('center'))}
            />
            <RibbonButton
              icon={AlignRight}
              title="Align Right (Ctrl+R)"
              active={state?.alignRight}
              disabled={disabled}
              onClick={cmd((c) => c.setTextAlign('right'))}
            />
            <RibbonButton
              icon={AlignJustify}
              title="Justify (Ctrl+J)"
              active={state?.alignJustify}
              disabled={disabled}
              onClick={cmd((c) => c.setTextAlign('justify'))}
            />
            <MenuTrigger open={openMenu === 'lineSpacing'}>
              <RibbonButton
                icon={Rows3}
                title="Line and Paragraph Spacing"
                variant="dropdown"
                disabled={disabled}
                onClick={() => toggleMenu('lineSpacing')}
              />
              <DropdownMenu
                open={openMenu === 'lineSpacing'}
                onClose={() => setOpenMenu(null)}
                items={LINE_SPACINGS.map((spacing) => ({
                  id: `line-${spacing}`,
                  label: `${spacing} lines`,
                  active: state?.lineSpacing === spacing,
                  onSelect: () => editor?.chain().focus().setLineSpacing(spacing).run()
                }))}
                minWidthClassName="min-w-[140px]"
              />
            </MenuTrigger>
            <MenuTrigger open={openMenu === 'shading'}>
              <RibbonButton
                icon={PaintBucket}
                title="Shading"
                variant="dropdown"
                disabled={disabled}
                colorIndicator={state?.paragraphShading}
                onClick={() => toggleMenu('shading')}
              />
              <FontColorPickerMenu
                open={openMenu === 'shading'}
                onClose={() => setOpenMenu(null)}
                selectedColor={state?.paragraphShading}
                onSelect={(color) => editor?.chain().focus().setParagraphShading(color).run()}
                onClear={() => editor?.chain().focus().setParagraphShading(null).run()}
                clearLabel="No Color"
              />
            </MenuTrigger>
            <MenuTrigger open={openMenu === 'borders'}>
              <RibbonButton
                icon={Square}
                title="Borders"
                variant="dropdown"
                disabled={disabled}
                active={state?.paragraphBorder}
                onClick={() => toggleMenu('borders')}
              />
              <DropdownMenu
                open={openMenu === 'borders'}
                onClose={() => setOpenMenu(null)}
                items={[
                  {
                    id: 'border-toggle',
                    label: state?.paragraphBorder ? 'Remove Border' : 'Add Border',
                    onSelect: () => editor?.chain().focus().toggleParagraphBorder('#bfbfbf').run()
                  }
                ]}
                minWidthClassName="min-w-[130px]"
              />
            </MenuTrigger>
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup title="Styles">
        <StyleGallery editor={editor} />
      </RibbonGroup>

      <RibbonGroup title="Editing">
        <RibbonButton
          icon={Search}
          label="Find"
          variant="large"
          disabled={disabled}
          onClick={() => openFindBar('find')}
        />
        <div className="flex flex-col gap-0.5">
          <RibbonButton
            icon={Replace}
            label="Replace"
            disabled={disabled}
            onClick={() => openFindBar('replace')}
          />
          <MenuTrigger open={openMenu === 'select'}>
            <RibbonButton
              icon={Search}
              label="Select"
              variant="dropdown"
              disabled={disabled}
              onClick={() => toggleMenu('select')}
            />
            <DropdownMenu
              open={openMenu === 'select'}
              onClose={() => setOpenMenu(null)}
              items={[
                {
                  id: 'select-all',
                  label: 'Select All',
                  onSelect: () => editor?.chain().focus().selectAll().run()
                },
                {
                  id: 'select-paragraph',
                  label: 'Select Current Paragraph',
                  onSelect: () => {
                    if (!editor) return
                    const { $from } = editor.state.selection
                    if ($from.depth === 0) return
                    const from = $from.start()
                    const to = $from.end()
                    editor.chain().focus().setTextSelection({ from, to }).run()
                  }
                }
              ]}
              minWidthClassName="min-w-[180px]"
            />
          </MenuTrigger>
        </div>
      </RibbonGroup>
    </div>
  )
}
