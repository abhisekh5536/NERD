import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PmNode } from '@tiptap/pm/model'
import fastDiff from 'fast-diff'
import {
  clampDocPosition,
  getBlockById,
  getLastInsertedBlockId,
  resolveInsertAnchor
} from '../../../ai/docService'

export type SuggestionType = 'replace' | 'insert' | 'delete' | 'format' | 'style'

export interface SuggestionRecord {
  id: string
  type: SuggestionType
  description: string
  blockId?: string
  /** blockId of content inserted by this suggestion (insert type only) */
  insertedBlockId?: string
  /** Doc slice JSON for precise revert */
  beforeFrom: number
  beforeTo: number
  beforeContent: unknown
  /** Current highlighted range (may differ after replace/insert) */
  from: number
  to: number
  /** Delete suggestions are decoration-only until accepted */
  deletePending?: boolean
}

export interface SuggestionsStorage {
  suggestions: Map<string, SuggestionRecord>
  lastCreatedId: string | null
  lastCreatedInsertedBlockId: string | null
}

const suggestionsKey = new PluginKey('suggestions')

function generateSuggestionId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function captureSlice(doc: PmNode, from: number, to: number): unknown {
  return doc.slice(from, to).toJSON()
}

function buildDecorations(doc: PmNode, suggestions: Map<string, SuggestionRecord>): DecorationSet {
  const decos: Decoration[] = []
  for (const rec of suggestions.values()) {
    if (rec.deletePending) {
      decos.push(
        Decoration.node(rec.from, rec.to, {
          class: 'suggestion-delete'
        })
      )
    } else if (rec.from < rec.to) {
      const text = doc.textBetween(rec.from, rec.to, '')
      if (text.length > 0) {
        const oldText = extractTextFromSlice(rec.beforeContent)
        if (oldText && oldText !== text && rec.type === 'replace') {
          applyInlineDiffDecorations(decos, rec.from, oldText, text)
        } else {
          decos.push(
            Decoration.inline(rec.from, rec.to, {
              class: 'suggestion-insert'
            })
          )
        }
      } else {
        decos.push(
          Decoration.node(rec.from, rec.to, {
            class: 'suggestion-insert'
          })
        )
      }
    }
  }
  return DecorationSet.create(doc, decos)
}

function extractTextFromSlice(sliceJson: unknown): string {
  if (!sliceJson || typeof sliceJson !== 'object') return ''
  const content = (sliceJson as { content?: unknown[] }).content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  const walk = (nodes: unknown[]): void => {
    for (const n of nodes) {
      if (!n || typeof n !== 'object') continue
      const node = n as { type?: string; text?: string; content?: unknown[] }
      if (node.text) parts.push(node.text)
      if (node.content) walk(node.content)
    }
  }
  walk(content)
  return parts.join('')
}

function applyInlineDiffDecorations(
  decos: Decoration[],
  baseFrom: number,
  oldText: string,
  newText: string
): void {
  const diffs = fastDiff(oldText, newText)
  let oldPos = 0
  let newPos = 0
  for (const [op, chunk] of diffs) {
    if (op === fastDiff.DELETE) {
      decos.push(
        Decoration.inline(baseFrom + oldPos, baseFrom + oldPos + chunk.length, {
          class: 'suggestion-delete'
        })
      )
      oldPos += chunk.length
    } else if (op === fastDiff.INSERT) {
      decos.push(
        Decoration.inline(baseFrom + newPos, baseFrom + newPos + chunk.length, {
          class: 'suggestion-insert'
        })
      )
      newPos += chunk.length
    } else {
      oldPos += chunk.length
      newPos += chunk.length
    }
  }
}



declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestions: {
      stageSuggestionReplace: (opts: {
        blockId: string
        content: any
        description: string
      }) => ReturnType
      stageSuggestionInsert: (opts: {
        afterBlockId: string
        content: any
        description: string
      }) => ReturnType
      stageSuggestionDelete: (opts: {
        blockId: string
        description: string
      }) => ReturnType
      stageSuggestionRange: (opts: {
        blockId: string
        from: number
        to: number
        description: string
        type: 'format' | 'style'
        beforeContent?: unknown
      }) => ReturnType
      stageSuggestionReplaceRange: (opts: {
        blockId: string
        from: number
        to: number
        newText: string
        description: string
      }) => ReturnType
      acceptSuggestion: (id: string) => ReturnType
      rejectSuggestion: (id: string) => ReturnType
      acceptAllSuggestions: () => ReturnType
      rejectAllSuggestions: () => ReturnType
    }
  }
}

export const Suggestions = Extension.create<unknown, SuggestionsStorage>({
  name: 'suggestions',

  addStorage() {
    return {
      suggestions: new Map<string, SuggestionRecord>(),
      lastCreatedId: null as string | null,
      lastCreatedInsertedBlockId: null as string | null
    }
  },

  addCommands() {
    return {
      stageSuggestionReplace:
        ({ blockId, content, description }) =>
        ({ editor, chain }) => {
          const found = getBlockById(editor, blockId)
          if (!found?.node) return false

          const { node, pos } = found
          const from = pos
          const to = pos + node.nodeSize
          const beforeContent = captureSlice(editor.state.doc, from, to)
          const id = generateSuggestionId()

          const ok = chain()
            .focus()
            .deleteRange({ from, to })
            .insertContentAt(from, content)
            .run()

          if (!ok) return false

          const newNode = editor.state.doc.nodeAt(from)
          const newTo = newNode ? from + newNode.nodeSize : from

          editor.storage.suggestions.suggestions.set(id, {
            id,
            type: 'replace',
            description,
            blockId,
            beforeFrom: from,
            beforeTo: to,
            beforeContent,
            from,
            to: newTo
          })
          editor.storage.suggestions.lastCreatedId = id

          editor.view.dispatch(editor.state.tr.setMeta(suggestionsKey, { refresh: true }))
          return true
        },

      stageSuggestionInsert:
        ({ afterBlockId, content, description }) =>
        ({ editor, chain }) => {
          const anchor = resolveInsertAnchor(editor, afterBlockId)
          if ('error' in anchor) return false

          const insertPos = clampDocPosition(editor, anchor.insertPos)
          const beforeContent = { type: 'doc', content: [] }
          const id = generateSuggestionId()

          const ok = chain().focus().insertContentAt(insertPos, content).run()
          if (!ok) return false

          const insertedSize = editor.state.doc.content.size
          let endPos = insertPos
          editor.state.doc.nodesBetween(insertPos, insertedSize, (n, p) => {
            if (p >= insertPos && endPos === insertPos) {
              endPos = p + n.nodeSize
            }
          })
          if (endPos === insertPos) {
            const nodeAt = editor.state.doc.nodeAt(insertPos)
            endPos = nodeAt ? insertPos + nodeAt.nodeSize : insertPos
          }

          const insertedBlockId = getLastInsertedBlockId(editor, insertPos, endPos)

          editor.storage.suggestions.suggestions.set(id, {
            id,
            type: 'insert',
            description,
            blockId: afterBlockId,
            insertedBlockId: insertedBlockId ?? undefined,
            beforeFrom: insertPos,
            beforeTo: insertPos,
            beforeContent,
            from: insertPos,
            to: endPos
          })
          editor.storage.suggestions.lastCreatedId = id
          editor.storage.suggestions.lastCreatedInsertedBlockId = insertedBlockId

          editor.view.dispatch(editor.state.tr.setMeta(suggestionsKey, { refresh: true }))
          return true
        },

      stageSuggestionDelete:
        ({ blockId, description }) =>
        ({ editor }) => {
          const found = getBlockById(editor, blockId)
          if (!found?.node) return false

          const { node, pos } = found
          const from = pos
          const to = pos + node.nodeSize
          const id = generateSuggestionId()

          editor.storage.suggestions.suggestions.set(id, {
            id,
            type: 'delete',
            description,
            blockId,
            beforeFrom: from,
            beforeTo: to,
            beforeContent: captureSlice(editor.state.doc, from, to),
            from,
            to,
            deletePending: true
          })
          editor.storage.suggestions.lastCreatedId = id

          editor.view.dispatch(editor.state.tr.setMeta(suggestionsKey, { refresh: true }))
          return true
        },

      stageSuggestionRange:
        ({ blockId, from, to, description, type, beforeContent: presetBefore }) =>
        ({ editor }) => {
          const found = getBlockById(editor, blockId)
          if (!found) return false

          const beforeContent = presetBefore ?? captureSlice(editor.state.doc, from, to)
          const id = generateSuggestionId()

          editor.storage.suggestions.suggestions.set(id, {
            id,
            type,
            description,
            blockId,
            beforeFrom: from,
            beforeTo: to,
            beforeContent,
            from,
            to
          })
          editor.storage.suggestions.lastCreatedId = id

          editor.view.dispatch(editor.state.tr.setMeta(suggestionsKey, { refresh: true }))
          return true
        },

      stageSuggestionReplaceRange:
        ({ blockId, from, to, newText, description }) =>
        ({ editor, chain }) => {
          const found = getBlockById(editor, blockId)
          if (!found) return false

          const beforeContent = captureSlice(editor.state.doc, from, to)
          const id = generateSuggestionId()

          const ok = chain().focus().deleteRange({ from, to }).insertContentAt(from, newText).run()
          if (!ok) return false

          const newTo = Math.min(from + newText.length, editor.state.doc.content.size)

          editor.storage.suggestions.suggestions.set(id, {
            id,
            type: 'replace',
            description,
            blockId,
            beforeFrom: from,
            beforeTo: to,
            beforeContent,
            from,
            to: newTo
          })
          editor.storage.suggestions.lastCreatedId = id

          editor.view.dispatch(editor.state.tr.setMeta(suggestionsKey, { refresh: true }))
          return true
        },

      acceptSuggestion:
        (id) =>
        ({ state, dispatch, editor }) => {
          const rec = editor.storage.suggestions.suggestions.get(id)
          if (!rec) return false

          let tr = state.tr

          if (rec.deletePending) {
            let from = rec.from
            let to = rec.to
            if (rec.blockId) {
              const found = getBlockById(editor, rec.blockId)
              if (found) {
                from = found.pos
                to = found.pos + found.node.nodeSize
              }
            }
            const docSize = tr.doc.content.size
            from = Math.max(0, Math.min(from, docSize))
            to = Math.max(from, Math.min(to, docSize))
            if (from < to) {
              tr = tr.delete(from, to)
            }
          }

          editor.storage.suggestions.suggestions.delete(id)
          tr = tr.setMeta(suggestionsKey, { refresh: true })

          if (dispatch) {
            dispatch(tr)
          }
          return true
        },

      rejectSuggestion:
        (id) =>
        ({ state, dispatch, editor }) => {
          const rec = editor.storage.suggestions.suggestions.get(id)
          if (!rec) return false

          let tr = state.tr

          if (!rec.deletePending) {
            const sliceJson = rec.beforeContent as { content?: unknown[] }
            if (sliceJson?.content) {
              const currentFrom = Math.min(rec.from, tr.doc.content.size)
              const currentTo = Math.min(rec.to, tr.doc.content.size)
              if (currentFrom < currentTo) {
                tr = tr.delete(currentFrom, currentTo)
              }

              try {
                const nodes = sliceJson.content.map((n) => state.schema.nodeFromJSON(n))
                let insertPos = Math.min(rec.beforeFrom, tr.doc.content.size)
                for (const node of nodes) {
                  tr = tr.insert(insertPos, node)
                  insertPos += node.nodeSize
                }
              } catch (err) {
                console.error('Failed to restore slice for suggestion', rec.id, err)
              }
            }
          }

          editor.storage.suggestions.suggestions.delete(id)
          tr = tr.setMeta(suggestionsKey, { refresh: true })

          if (dispatch) {
            dispatch(tr)
          }
          return true
        },

      acceptAllSuggestions:
        () =>
        ({ state, dispatch, editor }) => {
          const suggestions = editor.storage.suggestions.suggestions
          const ids = [...suggestions.keys()]
          if (ids.length === 0) return false

          let tr = state.tr

          const deleteRecs: { id: string; from: number; to: number }[] = []
          for (const id of ids) {
            const rec = suggestions.get(id)
            if (rec && rec.deletePending) {
              let from = rec.from
              let to = rec.to
              if (rec.blockId) {
                const found = getBlockById(editor, rec.blockId)
                if (found) {
                  from = found.pos
                  to = found.pos + found.node.nodeSize
                }
              }
              deleteRecs.push({ id, from, to })
            }
          }

          // Sort descending by 'from' position to avoid shifting of subsequent deletions
          deleteRecs.sort((a, b) => b.from - a.from)

          for (const rec of deleteRecs) {
            const docSize = tr.doc.content.size
            const from = Math.max(0, Math.min(rec.from, docSize))
            const to = Math.max(from, Math.min(rec.to, docSize))
            if (from < to) {
              tr = tr.delete(from, to)
            }
          }

          suggestions.clear()
          tr = tr.setMeta(suggestionsKey, { refresh: true })

          if (dispatch) {
            dispatch(tr)
          }
          return true
        },

      rejectAllSuggestions:
        () =>
        ({ state, dispatch, editor }) => {
          const suggestions = editor.storage.suggestions.suggestions
          const ids = [...suggestions.keys()]
          if (ids.length === 0) return false

          let tr = state.tr

          const recs = ids
            .map((id) => suggestions.get(id))
            .filter((rec): rec is SuggestionRecord => !!rec)
            .sort((a, b) => b.from - a.from)

          for (const rec of recs) {
            if (rec.deletePending) {
              continue
            }

            const sliceJson = rec.beforeContent as { content?: unknown[] }
            if (!sliceJson?.content) continue

            const currentFrom = Math.min(rec.from, tr.doc.content.size)
            const currentTo = Math.min(rec.to, tr.doc.content.size)
            if (currentFrom < currentTo) {
              tr = tr.delete(currentFrom, currentTo)
            }

            try {
              const nodes = sliceJson.content.map((n) => state.schema.nodeFromJSON(n))
              let insertPos = Math.min(rec.beforeFrom, tr.doc.content.size)
              for (const node of nodes) {
                tr = tr.insert(insertPos, node)
                insertPos += node.nodeSize
              }
            } catch (err) {
              console.error('Failed to restore slice for suggestion', rec.id, err)
            }
          }

          suggestions.clear()
          tr = tr.setMeta(suggestionsKey, { refresh: true })

          if (dispatch) {
            dispatch(tr)
          }
          return true
        },

    }
  },

  addProseMirrorPlugins() {
    const suggestionMap = this.storage.suggestions
    return [
      new Plugin({
        key: suggestionsKey,
        state: {
          init: (_, state) => buildDecorations(state.doc, suggestionMap),
          apply(tr, old, _oldState, newState) {
            if (tr.docChanged) {
              for (const rec of suggestionMap.values()) {
                rec.from = tr.mapping.map(rec.from, 1)
                rec.to = tr.mapping.map(rec.to, -1)
                if (rec.from > rec.to) rec.to = rec.from
              }
            }
            if (tr.getMeta(suggestionsKey)?.refresh || tr.docChanged) {
              return buildDecorations(newState.doc, suggestionMap)
            }
            return old.map(tr.mapping, tr.doc)
          }
        },
        props: {
          decorations(state) {
            return suggestionsKey.getState(state)
          }
        }
      })
    ]
  }
})
