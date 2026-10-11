import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EditorState } from 'prosemirror-state'
import { schema } from '@eigenpal/docx-editor-core/prosemirror'
import { createEmptyDoc } from '@eigenpal/docx-editor-core/prosemirror/conversion'
import {
  insertParagraphIntoState,
  resolveInsertedParaId
} from '../src/renderer/editor/paragraphInsert'
import type { ParagraphSnapshot } from '../src/renderer/editor/editorBridge'

const AI_AUTHOR = 'WordClone AI Test'

function paragraphCount(state: EditorState): number {
  let count = 0
  state.doc.descendants((node) => {
    if (node.type.name === 'paragraph' || node.type.name === 'heading') count++
    return true
  })
  return count
}

test('resolveInsertedParaId returns paragraph after anchor', () => {
  const before: ParagraphSnapshot[] = [{ paraId: 'AAA11111', text: 'First', nodeType: 'paragraph' }]
  const after: ParagraphSnapshot[] = [
    { paraId: 'AAA11111', text: 'First', nodeType: 'paragraph' },
    { paraId: 'BBB22222', text: 'Second', nodeType: 'paragraph' }
  ]
  assert.equal(resolveInsertedParaId(before, after, 'AAA11111'), 'BBB22222')
})

test('resolveInsertedParaId returns first block after __start__ insert', () => {
  const before: ParagraphSnapshot[] = [{ paraId: 'OLD00001', text: '', nodeType: 'paragraph' }]
  const after: ParagraphSnapshot[] = [
    { paraId: 'NEW00001', text: 'YOUR NAME', nodeType: 'heading' },
    { paraId: 'OLD00001', text: '', nodeType: 'paragraph' }
  ]
  assert.equal(resolveInsertedParaId(before, after, '__start__'), 'NEW00001')
})

test('chained insertParagraphIntoState creates distinct paragraphs', () => {
  const doc = createEmptyDoc()
  let state = EditorState.create({ schema, doc })
  assert.equal(paragraphCount(state), 1)

  const first = insertParagraphIntoState(state, {
    afterBlockId: '__start__',
    text: 'YOUR NAME',
    styleId: 'Heading1',
    blockType: 'heading1',
    author: AI_AUTHOR
  })
  assert.ok(!('error' in first), first.error)
  assert.ok(first.newParaId)
  assert.notEqual(first.newParaId, undefined)
  state = first.state
  assert.equal(paragraphCount(state), 2)

  const second = insertParagraphIntoState(state, {
    afterBlockId: first.newParaId!,
    text: 'Phone: +91-0000000000',
    styleId: 'Normal',
    blockType: 'paragraph',
    author: AI_AUTHOR
  })
  assert.ok(!('error' in second), second.error)
  assert.ok(second.newParaId)
  assert.notEqual(second.newParaId, first.newParaId)
  state = second.state
  assert.equal(paragraphCount(state), 3)

  const snapshots: ParagraphSnapshot[] = []
  state.doc.descendants((node) => {
    if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return true
    const paraId = node.attrs.paraId as string | undefined
    if (!paraId) return true
    snapshots.push({ paraId, text: node.textContent, nodeType: node.type.name })
    return true
  })

  assert.equal(snapshots.length, 3)
  assert.equal(snapshots[0]?.text, 'YOUR NAME')
  assert.equal(snapshots[1]?.text, 'Phone: +91-0000000000')
  assert.ok(!snapshots.some((s) => s.text.includes('\nYOUR NAME\n')))
})
