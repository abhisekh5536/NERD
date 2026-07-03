import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

let _blockCounter = 0
const generateBlockId = (): string => `blk_${++_blockCounter}_${Date.now().toString(36)}`

const blockIdKey = new PluginKey('blockId')

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'table',
  'image'
])

function assignMissingBlockIds(
  doc: import('@tiptap/pm/model').Node,
  tr: import('@tiptap/pm/state').Transaction
): boolean {
  let modified = false
  doc.descendants((node, pos) => {
    if (BLOCK_TYPES.has(node.type.name) && !node.attrs.blockId) {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        blockId: generateBlockId()
      })
      modified = true
    }
  })
  return modified
}

/**
 * Assigns a stable `blockId` attribute to every block-level node. The agent
 * uses these IDs as durable anchors for reading and editing specific blocks.
 */
export const BlockId = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: [...BLOCK_TYPES],
        attributes: {
          blockId: {
            default: null,
            parseHTML: (el) => el.getAttribute('data-block-id'),
            renderHTML: (attrs) => {
              if (!attrs.blockId) return {}
              return { 'data-block-id': attrs.blockId }
            }
          }
        }
      }
    ]
  },

  onCreate() {
    const { editor } = this
    const { state } = editor
    const tr = state.tr
    if (assignMissingBlockIds(state.doc, tr)) {
      editor.view.dispatch(tr)
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: blockIdKey,
        appendTransaction(_transactions, _oldState, newState) {
          const tr = newState.tr
          if (assignMissingBlockIds(newState.doc, tr)) {
            return tr
          }
          return null
        }
      })
    ]
  }
})
