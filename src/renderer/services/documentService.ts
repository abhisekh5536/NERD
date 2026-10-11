import type { RefObject } from 'react'
import { createDocumentWithText, createEmptyDocument } from '@eigenpal/docx-editor-react'
import type { WordCloneEditorRef } from '../editor/editorBridge'
import { getPlainText, saveEditorBuffer } from '../editor/editorBridge'
import { useAiStore } from '../store/aiStore'
import { useDocumentStore } from '../store/documentStore'

function clearAiDraftState(): void {
  const aiStore = useAiStore.getState()
  aiStore.clearSuggestions()
  aiStore.clearActiveTools()
  aiStore.resetStreamBuffers()
}

function askDiscardChanges(actionLabel: string): boolean {
  const { isDirty } = useDocumentStore.getState()
  if (!isDirty) return true
  return window.confirm(`You have unsaved changes. Do you want to continue and ${actionLabel}?`)
}

function buildSaveDefaultName(): string {
  const { displayName } = useDocumentStore.getState()
  const hasKnownExtension = /\.[a-z0-9]+$/i.test(displayName)
  return hasKnownExtension ? displayName : `${displayName}.docx`
}

function plainTextFromImport(content: string, contentType: 'html' | 'text'): string {
  if (contentType === 'text') return content
  const div = document.createElement('div')
  div.innerHTML = content
  return div.textContent ?? ''
}

async function loadIntoEditor(
  editorRef: RefObject<WordCloneEditorRef | null>,
  payload: {
    bytes?: ArrayBuffer
    importDocument?: ReturnType<typeof createEmptyDocument>
    format: 'docx' | 'doc' | 'html' | 'txt'
  }
): Promise<void> {
  const editor = editorRef.current
  if (editor && payload.bytes) {
    await editor.loadDocumentBuffer(payload.bytes)
    return
  }
  if (editor && payload.importDocument) {
    editor.loadDocument(payload.importDocument)
    return
  }
  useDocumentStore.getState().setDocumentPayload({
    documentBuffer: payload.bytes ?? null,
    importDocument: payload.importDocument ?? null,
    format: payload.format
  })
}

export async function loadRecentFiles(): Promise<void> {
  try {
    const recentFiles = (await window.api.file.getRecentFiles()) ?? []
    useDocumentStore.getState().setRecentFiles(recentFiles)
  } catch {
    useDocumentStore.getState().setRecentFiles([])
  }
}

export async function createNewDocument(
  editorRef: RefObject<WordCloneEditorRef | null>
): Promise<boolean> {
  const store = useDocumentStore.getState()
  store.beginOperation('new')

  if (!askDiscardChanges('discard them')) {
    store.finishOperation()
    return false
  }

  clearAiDraftState()
  store.resetToNewDocument()
  const editor = editorRef.current
  if (editor) {
    editor.loadDocument(createEmptyDocument())
  }
  store.closeBackstage()
  store.finishOperation('Created a new blank document.')
  return true
}

export async function openDocument(
  editorRef: RefObject<WordCloneEditorRef | null>
): Promise<boolean> {
  return openDocumentAtPath(editorRef)
}

export async function openDocumentAtPath(
  editorRef: RefObject<WordCloneEditorRef | null>,
  filePath?: string
): Promise<boolean> {
  const store = useDocumentStore.getState()
  store.beginOperation('open')

  if (!askDiscardChanges('discard them')) {
    store.finishOperation()
    return false
  }

  let result: Awaited<ReturnType<typeof window.api.file.openDocument>>
  try {
    result = await window.api.file.openDocument(filePath)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to open the selected document.'
    store.failOperation(message)
    return false
  }

  if (result.canceled) {
    store.finishOperation()
    return false
  }

  if (!result.filePath) {
    store.failOperation(result.error ?? 'The selected document could not be loaded.')
    return false
  }

  try {
    if (result.bytes) {
      await loadIntoEditor(editorRef, {
        bytes: result.bytes,
        format: result.format ?? 'docx'
      })
    } else if (typeof result.content === 'string') {
      const plain = plainTextFromImport(result.content, result.contentType ?? 'text')
      const importDocument = createDocumentWithText(plain)
      await loadIntoEditor(editorRef, {
        importDocument,
        format: result.format ?? 'txt'
      })
    } else {
      store.failOperation(result.error ?? 'The selected document could not be loaded.')
      return false
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load the document into the editor.'
    store.failOperation(message)
    return false
  }

  clearAiDraftState()
  store.markClean(result.filePath)
  store.addRecentFile(result.filePath)
  store.closeBackstage()
  const displayName = useDocumentStore.getState().displayName
  const warningText =
    result.warnings && result.warnings.length > 0 ? ` (${result.warnings.length} warnings)` : ''
  store.finishOperation(`Opened ${displayName}${warningText}.`)
  return true
}

export async function saveDocument(
  editorRef: RefObject<WordCloneEditorRef | null>
): Promise<boolean> {
  const store = useDocumentStore.getState()
  store.beginOperation('save')

  const format = store.currentFormat
  const bytes = format === 'docx' ? await saveEditorBuffer(editorRef.current) : undefined
  const content =
    format !== 'docx' ? getPlainText(editorRef.current) : undefined

  const payload = {
    filePath: store.filePath ?? undefined,
    defaultFileName: buildSaveDefaultName(),
    format,
    bytes: bytes ?? undefined,
    content
  }

  let result: Awaited<ReturnType<typeof window.api.file.saveDocument>>
  try {
    result = await window.api.file.saveDocument(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save the document.'
    store.failOperation(message)
    return false
  }

  if (result.canceled) {
    store.finishOperation()
    return false
  }

  if (!result.persisted || !result.filePath) {
    store.failOperation(result.error ?? 'The document was not saved.')
    return false
  }

  store.markClean(result.filePath)
  store.addRecentFile(result.filePath)
  store.closeBackstage()
  store.finishOperation(`Saved ${useDocumentStore.getState().displayName}.`)
  return true
}

export async function saveDocumentAs(
  editorRef: RefObject<WordCloneEditorRef | null>
): Promise<boolean> {
  const store = useDocumentStore.getState()
  store.beginOperation('saveAs')

  const format = store.currentFormat
  const bytes = format === 'docx' ? await saveEditorBuffer(editorRef.current) : undefined
  const content = format !== 'docx' ? getPlainText(editorRef.current) : undefined

  const payload = {
    filePath: store.filePath ?? undefined,
    defaultFileName: buildSaveDefaultName(),
    format,
    bytes: bytes ?? undefined,
    content
  }

  let result: Awaited<ReturnType<typeof window.api.file.saveDocumentAs>>
  try {
    result = await window.api.file.saveDocumentAs(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save the document.'
    store.failOperation(message)
    return false
  }

  if (result.canceled) {
    store.finishOperation()
    return false
  }

  if (!result.persisted || !result.filePath) {
    store.failOperation(result.error ?? 'The document was not saved.')
    return false
  }

  store.markClean(result.filePath)
  store.addRecentFile(result.filePath)
  store.closeBackstage()
  store.finishOperation(`Saved a copy as ${useDocumentStore.getState().displayName}.`)
  return true
}

export async function printDocument(
  editorRef: RefObject<WordCloneEditorRef | null>
): Promise<boolean> {
  const store = useDocumentStore.getState()
  store.beginOperation('print')

  const editor = editorRef.current
  if (editor) {
    try {
      editor.print()
      store.closeBackstage()
      store.finishOperation('Print dialog opened.')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open the print dialog.'
      store.failOperation(message)
      return false
    }
  }

  let result: Awaited<ReturnType<typeof window.api.file.printDocument>>
  try {
    result = await window.api.file.printDocument()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to open the print dialog.'
    store.failOperation(message)
    return false
  }

  if (result.canceled) {
    store.finishOperation('Print canceled.')
    return false
  }

  if (!result.success) {
    store.failOperation(result.error ?? 'Print failed.')
    return false
  }

  store.closeBackstage()
  store.finishOperation('Print dialog opened.')
  return true
}

export async function clearRecentFiles(): Promise<void> {
  const store = useDocumentStore.getState()
  store.beginOperation('recent')
  try {
    await window.api.file.clearRecentFiles()
    store.setRecentFiles([])
    store.finishOperation('Cleared recent files.')
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to clear recent file history.'
    store.failOperation(message)
  }
}

export function shouldCloseWindow(): boolean {
  const { isDirty } = useDocumentStore.getState()
  if (!isDirty) return true
  return window.confirm('You have unsaved changes. Do you want to close without saving?')
}
