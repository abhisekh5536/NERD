import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Highlight from '@tiptap/extension-highlight'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { PaginationPlus } from 'tiptap-pagination-plus'
import { PAGE_SIZES, inchToPx } from '../../lib/units'
import { FontSize } from './extensions/FontSize'
import { BlockId } from './extensions/BlockId'
import { Suggestions } from './extensions/Suggestions'
import { ParagraphFormat } from './extensions/ParagraphFormat'

const MARGIN = inchToPx(1) // 96px / 1 inch, matching the Word default.

const STARTER_CONTENT = `
  <h1>Document title</h1>
  <p>Welcome to <strong>WordClone</strong> — a Microsoft Word-style editor built on Electron, React and TipTap. The page below is a real <em>Letter</em>-sized canvas (8.5" &times; 11") with one-inch margins, and it paginates automatically as you type.</p>
  <h2>Getting started</h2>
  <p>Use the ribbon above to format text. The <strong>Home</strong> tab wires up the essentials:</p>
  <ul>
    <li>Font family, size, color and the bold / italic / underline marks.</li>
    <li>Paragraph alignment, bulleted and numbered lists, and indentation.</li>
    <li>Quick styles for the body text and headings.</li>
  </ul>
  <h2>What happens as the document grows</h2>
  <p>Keep adding content and the editor inserts a new page once the current one fills up. Selection, undo/redo and find all keep working because the document stays a single flow — pagination is a visual layer, not a structural split.</p>
  <p>Replace this text with your own. Everything here is editable.</p>
`

export function useWordEditor(): Editor | null {
  return useEditor({
    extensions: [
      StarterKit,
      BlockId,
      Suggestions,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      Subscript,
      Superscript,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      FontSize,
      ParagraphFormat,
      Color,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: true }),
      PaginationPlus.configure({
        pageWidth: PAGE_SIZES.Letter.width,
        pageHeight: PAGE_SIZES.Letter.height,
        pageGap: 24,
        pageGapBorderSize: 1,
        pageGapBorderColor: '#c9c9c9',
        pageBreakBackground: '#e6e6e6',
        marginTop: MARGIN,
        marginBottom: MARGIN,
        marginLeft: MARGIN,
        marginRight: MARGIN,
        headerLeft: '',
        headerRight: '',
        footerLeft: '',
        footerRight: ''
      })
    ],
    autofocus: 'start',
    content: STARTER_CONTENT,
    editorProps: {
      attributes: {
        class: 'word-page',
        spellcheck: 'true',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Document content'
      }
    }
  })
}

export default function WordEditor({ editor }: { editor: Editor | null }) {
  return <EditorContent editor={editor} className="word-editor" />
}
