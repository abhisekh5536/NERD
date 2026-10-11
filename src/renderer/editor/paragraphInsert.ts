import type { WordCloneEditorRef } from './editorBridge'
import { collectParagraphSnapshots, type ParagraphSnapshot } from './editorBridge'
import { ensureParaIdsInState } from '@eigenpal/docx-editor-core/prosemirror'
import { findParaIdRange } from '@eigenpal/docx-editor-core/prosemirror/paraText'
import {
  createCommentIdAllocator,
  type CommentIdAllocator
} from '@eigenpal/docx-editor-core/prosemirror/commentIdAllocator'

type PmEditorState = NonNullable<
  ReturnType<NonNullable<ReturnType<WordCloneEditorRef['getEditorRef']>>['getState']>
>

function snapshotsFromDoc(doc: PmEditorState['doc']): ParagraphSnapshot[] {
  const snapshots: ParagraphSnapshot[] = []
  doc.descendants((node) => {
    const name = node.type.name
    if (name !== 'paragraph' && name !== 'heading') return true
    const paraId = node.attrs.paraId as string | undefined
    if (!paraId) return true
    snapshots.push({
      paraId,
      text: node.textContent,
      styleId: node.attrs.styleId as string | undefined,
      nodeType: name
    })
    return true
  })
  return snapshots
}

export function blockTypeToStyleId(blockType?: string): string {
  switch (blockType) {
    case 'heading1':
      return 'Heading1'
    case 'heading2':
      return 'Heading2'
    case 'heading3':
      return 'Heading3'
    case 'blockquote':
      return 'Quote'
    default:
      return 'Normal'
  }
}

function seedAllocatorFromState(allocator: CommentIdAllocator, state: PmEditorState): void {
  let maxId = 0
  state.doc.descendants((node) => {
    for (const mark of node.marks) {
      const revisionId = mark.attrs.revisionId as number | undefined
      if (typeof revisionId === 'number') {
        maxId = Math.max(maxId, revisionId)
      }
    }
    return true
  })
  if (maxId > 0) allocator.seedAbove(maxId)
}

export function resolveInsertedParaId(
  before: ParagraphSnapshot[],
  after: ParagraphSnapshot[],
  afterBlockId: string
): string | null {
  const beforeIds = new Set(before.map((p) => p.paraId))
  const newlyAdded = after.filter((p) => !beforeIds.has(p.paraId))
  if (newlyAdded.length === 1) return newlyAdded[0]!.paraId

  if (afterBlockId === '__start__') {
    return after[0]?.paraId ?? null
  }

  const anchorIdx = after.findIndex((p) => p.paraId === afterBlockId)
  if (anchorIdx >= 0 && anchorIdx + 1 < after.length) {
    return after[anchorIdx + 1]!.paraId
  }

  return newlyAdded[0]?.paraId ?? null
}

export type InsertParagraphOptions = {
  afterBlockId: string
  text: string
  styleId: string
  blockType?: string
  author: string
}

type InsertParagraphBuildResult =
  | {
      tr: ReturnType<PmEditorState['tr']['insert']>
      revisionId: number
      beforeSnapshots: ParagraphSnapshot[]
      afterBlockId: string
    }
  | { error: string }

function buildInsertParagraphTransaction(
  state: PmEditorState,
  options: InsertParagraphOptions
): InsertParagraphBuildResult {
  const { schema, doc } = state
  const insertionMarkType = schema.marks.insertion
  if (!insertionMarkType) {
    return { error: 'Tracked-change schema unavailable.' }
  }

  let insertPos: number
  if (options.afterBlockId === '__start__') {
    insertPos = 0
  } else {
    const range = findParaIdRange(doc, options.afterBlockId)
    if (!range) return { error: `Anchor ${options.afterBlockId} not found.` }
    if (doc.resolve(range.from).depth !== 0) {
      return { error: 'Insert anchor is not a top-level paragraph.' }
    }
    insertPos = range.to
  }

  const allocator = createCommentIdAllocator()
  seedAllocatorFromState(allocator, state)
  const revisionId = allocator.next()
  const date = new Date().toISOString()
  const insertionMark = insertionMarkType.create({
    revisionId,
    author: options.author,
    date
  })

  const isHeading =
    options.blockType?.startsWith('heading') || /^Heading/i.test(options.styleId)
  const nodeType =
    isHeading && schema.nodes.heading ? schema.nodes.heading : schema.nodes.paragraph
  if (!nodeType) return { error: 'Paragraph node type unavailable.' }

  const content = options.text ? schema.text(options.text, [insertionMark]) : null
  const newNode = nodeType.create({ styleId: options.styleId }, content)

  return {
    tr: state.tr.insert(insertPos, newNode),
    revisionId,
    beforeSnapshots: snapshotsFromDoc(doc),
    afterBlockId: options.afterBlockId
  }
}

export function insertParagraphIntoState(
  state: PmEditorState,
  options: InsertParagraphOptions
): { state: PmEditorState; newParaId: string | null; revisionId: number } | { error: string } {
  const built = buildInsertParagraphTransaction(state, options)
  if ('error' in built) return built

  const nextState = ensureParaIdsInState(state.apply(built.tr))
  const afterSnapshots = snapshotsFromDoc(nextState.doc)
  const newParaId = resolveInsertedParaId(
    built.beforeSnapshots,
    afterSnapshots,
    built.afterBlockId
  )

  return { state: nextState, newParaId, revisionId: built.revisionId }
}

export function insertParagraphAfter(
  editor: WordCloneEditorRef | null,
  options: InsertParagraphOptions
): { success: boolean; newParaId?: string; revisionId?: number; error?: string } {
  const paged = editor?.getEditorRef()
  const view = paged?.getView()
  if (!editor || !view) return { success: false, error: 'Editor not ready.' }

  const before = collectParagraphSnapshots(editor)
  const built = buildInsertParagraphTransaction(view.state, options)
  if ('error' in built) return { success: false, error: built.error }

  view.dispatch(built.tr)

  const withParaIds = ensureParaIdsInState(view.state)
  if (withParaIds !== view.state) {
    view.updateState(withParaIds)
  }

  try {
    paged?.relayout()
  } catch {
    /* layout will catch up on the next edit */
  }

  const after = collectParagraphSnapshots(editor)
  const newParaId =
    resolveInsertedParaId(built.beforeSnapshots, after, built.afterBlockId) ??
    resolveInsertedParaId(before, after, options.afterBlockId)
  if (!newParaId) return { success: false, error: 'Failed to resolve inserted paragraph id.' }

  return { success: true, newParaId, revisionId: built.revisionId }
}
