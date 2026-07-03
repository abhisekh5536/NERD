import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

type BlockAttrs = Record<string, unknown>

function isParagraphLike(node: ProseMirrorNode): boolean {
  return node.type.name === 'paragraph' || node.type.name === 'heading'
}

function updateParagraphLikeNodes(
  editor: import('@tiptap/core').Editor,
  updater: (attrs: BlockAttrs) => BlockAttrs
): boolean {
  const { state, view } = editor
  const { from, to, empty, $from } = state.selection
  const tr = state.tr
  let changed = false

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!isParagraphLike(node)) return
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...updater(node.attrs) })
    changed = true
  })

  if (!changed && empty) {
    const node = $from.parent
    if (isParagraphLike(node) && $from.depth > 0) {
      const pos = $from.before()
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...updater(node.attrs) })
      changed = true
    }
  }

  if (changed) view.dispatch(tr)
  return changed
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphFormat: {
      setLineSpacing: (lineSpacing: string) => ReturnType
      setParagraphShading: (color: string | null) => ReturnType
      toggleParagraphBorder: (color?: string) => ReturnType
    }
  }
}

export const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineSpacing: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineSpacing) return {}
              return { style: `line-height: ${attributes.lineSpacing};` }
            }
          },
          paragraphShading: {
            default: null,
            parseHTML: (element) => element.style.backgroundColor || null,
            renderHTML: (attributes) => {
              if (!attributes.paragraphShading) return {}
              return { style: `background-color: ${attributes.paragraphShading};` }
            }
          },
          paragraphBorder: {
            default: null,
            parseHTML: (element) => {
              const border = element.style.border
              if (!border) return null
              const matches = border.match(/#(?:[0-9a-f]{3}){1,2}|rgb\([^)]*\)/i)
              return matches?.[0] ?? '#bfbfbf'
            },
            renderHTML: (attributes) => {
              if (!attributes.paragraphBorder) return {}
              return {
                style: `border: 1px solid ${attributes.paragraphBorder}; padding: 2px 4px;`
              }
            }
          }
        }
      }
    ]
  },

  addCommands() {
    return {
      setLineSpacing:
        (lineSpacing) =>
        ({ editor }) =>
          updateParagraphLikeNodes(editor, () => ({ lineSpacing })),

      setParagraphShading:
        (color) =>
        ({ editor }) =>
          updateParagraphLikeNodes(editor, () => ({ paragraphShading: color })),

      toggleParagraphBorder:
        (color = '#bfbfbf') =>
        ({ editor }) => {
          const attrs = editor.getAttributes('paragraph')
          const isActive = Boolean(attrs.paragraphBorder)
          return updateParagraphLikeNodes(editor, () => ({
            paragraphBorder: isActive ? null : color
          }))
        }
    }
  }
})
