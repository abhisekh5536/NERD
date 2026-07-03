import type { Editor } from '@tiptap/core'
import { useAiStore } from '../store/aiStore'
import { useDocumentStore } from '../store/documentStore'

type ContentType = 'html' | 'text'

interface OpenDocumentResult {
  canceled: boolean
  filePath?: string
  content?: string
  contentType?: ContentType
  warnings?: string[]
  error?: string
}

interface SaveDocumentResult {
  canceled: boolean
  filePath?: string
  persisted: boolean
  error?: string
}

interface PrintDocumentResult {
  success: boolean
  canceled?: boolean
  error?: string
}

export const BLANK_DOCUMENT_HTML = '<p></p>'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function plainTextToHtml(value: string): string {
  const lines = value.split(/\r?\n/)
  return lines.map((line) => `<p>${escapeHtml(line) || '<br />'}</p>`).join('')
}

function applyEditorContent(editor: Editor, content: string, contentType: ContentType = 'html'): void {
  if (contentType === 'text') {
    editor.commands.setContent(plainTextToHtml(content), false)
    return
  }
  editor.commands.setContent(content || BLANK_DOCUMENT_HTML, false)
}

function clearAiDraftState(): void {
  const aiStore = useAiStore.getState()
  aiStore.clearSuggestions()
  aiStore.clearActiveTools()
  aiStore.resetStreamBuffers()
}

function askDiscardChanges(actionLabel: string): boolean {
  const { isDirty } = useDocumentStore.getState()
  if (!isDirty) return true
  return window.confirm(
    `You have unsaved changes. Do you want to continue and ${actionLabel}?`
  )
}

function buildSaveDefaultName(): string {
  const { displayName } = useDocumentStore.getState()
  const hasKnownExtension = /\.[a-z0-9]+$/i.test(displayName)
  return hasKnownExtension ? displayName : `${displayName}.docx`
}

export async function loadRecentFiles(): Promise<void> {
  try {
    const recentFiles = (await window.api.file.getRecentFiles()) ?? []
    useDocumentStore.getState().setRecentFiles(recentFiles)
  } catch {
    useDocumentStore.getState().setRecentFiles([])
  }
}

export async function createNewDocument(editor: Editor | null): Promise<boolean> {
  if (!editor) return false
  const store = useDocumentStore.getState()
  store.beginOperation('new')

  if (!askDiscardChanges('discard them')) {
    store.finishOperation()
    return false
  }

  applyEditorContent(editor, BLANK_DOCUMENT_HTML, 'html')
  clearAiDraftState()
  store.resetToNewDocument()
  store.closeBackstage()
  store.finishOperation('Created a new blank document.')
  return true
}

export async function openDocument(editor: Editor | null): Promise<boolean> {
  return openDocumentAtPath(editor)
}

export async function openDocumentAtPath(
  editor: Editor | null,
  filePath?: string
): Promise<boolean> {
  if (!editor) return false
  const store = useDocumentStore.getState()
  store.beginOperation('open')

  if (!askDiscardChanges('discard them')) {
    store.finishOperation()
    return false
  }

  let result: OpenDocumentResult
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

  if (!result.filePath || typeof result.content !== 'string') {
    store.failOperation(result.error ?? 'The selected document could not be loaded.')
    return false
  }

  applyEditorContent(editor, result.content, result.contentType ?? 'html')
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

export async function saveDocument(editor: Editor | null): Promise<boolean> {
  if (!editor) return false
  const store = useDocumentStore.getState()
  store.beginOperation('save')

  const payload = {
    filePath: store.filePath ?? undefined,
    content: editor.getHTML(),
    defaultFileName: buildSaveDefaultName()
  }

  let result: SaveDocumentResult
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
  const displayName = useDocumentStore.getState().displayName
  store.finishOperation(`Saved ${displayName}.`)
  return true
}

export async function saveDocumentAs(editor: Editor | null): Promise<boolean> {
  if (!editor) return false
  const store = useDocumentStore.getState()
  store.beginOperation('saveAs')

  const payload = {
    filePath: store.filePath ?? undefined,
    content: editor.getHTML(),
    defaultFileName: buildSaveDefaultName()
  }

  let result: SaveDocumentResult
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
  const displayName = useDocumentStore.getState().displayName
  store.finishOperation(`Saved a copy as ${displayName}.`)
  return true
}

export async function printDocument(): Promise<boolean> {
  const store = useDocumentStore.getState()
  store.beginOperation('print')

  let result: PrintDocumentResult
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
