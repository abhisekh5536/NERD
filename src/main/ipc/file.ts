import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { copyFile, mkdir, readdir, readFile, unlink, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import { detectFormat, type DocumentFormat } from './fileFormats'

export interface OpenDocumentPayload {
  filePath?: string
}

export interface OpenDocumentResult {
  canceled: boolean
  filePath?: string
  bytes?: ArrayBuffer
  content?: string
  contentType?: 'html' | 'text'
  format?: DocumentFormat
  warnings?: string[]
  error?: string
}

export interface SaveDocumentPayload {
  filePath?: string
  defaultFileName?: string
  format?: DocumentFormat
  bytes?: ArrayBuffer | Uint8Array
  content?: string
}

export interface SaveDocumentResult {
  canceled: boolean
  filePath?: string
  persisted: boolean
  format?: DocumentFormat
  error?: string
}

export interface PrintDocumentResult {
  success: boolean
  canceled?: boolean
  error?: string
}

export interface OpenFileResult {
  canceled: boolean
  filePath?: string
}

export interface SaveFilePayload {
  filePath?: string
  content: string
  bytes?: ArrayBuffer | Uint8Array
  format?: DocumentFormat
}

export interface SaveFileResult {
  canceled: boolean
  filePath?: string
  persisted: boolean
  error?: string
}

const OPEN_DOCUMENT_FILTERS = [
  { name: 'Word Documents', extensions: ['docx', 'doc'] },
  { name: 'Web Pages', extensions: ['html', 'htm'] },
  { name: 'Text Files', extensions: ['txt', 'md'] },
  { name: 'All Files', extensions: ['*'] }
]

const SAVE_DOCUMENT_FILTERS = [
  { name: 'Word Document', extensions: ['docx'] },
  { name: 'Web Page', extensions: ['html', 'htm'] },
  { name: 'Text File', extensions: ['txt'] },
  { name: 'All Files', extensions: ['*'] }
]

const RECENT_FILES_PATH = join(app.getPath('userData'), 'wordclone-recent-files.json')
const MAX_RECENT_FILES = 20
const DEFAULT_FILE_NAME = 'Document1.docx'
const DOC_CONVERTER_COMMANDS = ['soffice', 'libreoffice']

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? undefined
}

function readRecentFiles(): string[] {
  try {
    if (!existsSync(RECENT_FILES_PATH)) return []
    const raw = JSON.parse(readFileSync(RECENT_FILES_PATH, 'utf-8'))
    if (!Array.isArray(raw)) return []
    return raw.filter((value): value is string => typeof value === 'string')
  } catch {
    return []
  }
}

function writeRecentFiles(paths: string[]): void {
  writeFileSync(RECENT_FILES_PATH, JSON.stringify(paths.slice(0, MAX_RECENT_FILES), null, 2), 'utf-8')
}

function updateRecentFile(filePath: string): void {
  const current = readRecentFiles().filter((value) => value !== filePath)
  writeRecentFiles([filePath, ...current])
}

function getExistingRecentFiles(): string[] {
  return readRecentFiles().filter((filePath) => existsSync(filePath))
}

function normalizeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return fallback
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

function toNodeBuffer(bytes: ArrayBuffer | Uint8Array): Buffer {
  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  return Buffer.from(bytes)
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => reject(error))
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr || `${command} exited with code ${code ?? 'unknown'}`))
    })
  })
}

async function convertLegacyDocToDocx(filePath: string): Promise<string> {
  const tempDir = join(app.getPath('temp'), 'wordclone-doc-import')
  await mkdir(tempDir, { recursive: true })

  const extension = extname(filePath).toLowerCase()
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const sourceName = `${basename(filePath, extension)}-${token}.doc`
  const stagedDocPath = join(tempDir, sourceName)
  const expectedDocxPath = stagedDocPath.replace(/\.doc$/i, '.docx')
  await copyFile(filePath, stagedDocPath)

  let lastError: unknown = null
  for (const command of DOC_CONVERTER_COMMANDS) {
    try {
      await runCommand(command, ['--headless', '--convert-to', 'docx', '--outdir', tempDir, stagedDocPath])

      if (existsSync(expectedDocxPath)) {
        await unlink(stagedDocPath).catch(() => undefined)
        return expectedDocxPath
      }

      const files = await readdir(tempDir)
      const match = files.find(
        (name) =>
          name.toLowerCase().startsWith(`${basename(stagedDocPath, '.doc').toLowerCase()}`) &&
          name.toLowerCase().endsWith('.docx')
      )
      if (match) {
        await unlink(stagedDocPath).catch(() => undefined)
        return join(tempDir, match)
      }
    } catch (error) {
      lastError = error
    }
  }

  await unlink(stagedDocPath).catch(() => undefined)
  const fallbackMessage = 'Install LibreOffice to open legacy .doc files, then try again.'
  const normalizedMessage = normalizeErrorMessage(lastError, fallbackMessage)
  const errorMessage = /ENOENT/i.test(normalizedMessage) ? fallbackMessage : normalizedMessage
  throw new Error(errorMessage)
}

async function readBinaryDocx(filePath: string): Promise<{ bytes: ArrayBuffer; warnings: string[] }> {
  const buffer = await readFile(filePath)
  return { bytes: bufferToArrayBuffer(buffer), warnings: [] }
}

async function readLegacyDoc(filePath: string): Promise<{ bytes: ArrayBuffer; warnings: string[] }> {
  const convertedDocxPath = await convertLegacyDocToDocx(filePath)
  const result = await readBinaryDocx(convertedDocxPath)
  await unlink(convertedDocxPath).catch(() => undefined)
  return {
    bytes: result.bytes,
    warnings: ['Converted legacy .doc format to .docx during import.']
  }
}

async function readDocument(
  filePath: string
): Promise<
  | { kind: 'binary'; bytes: ArrayBuffer; format: DocumentFormat; warnings: string[] }
  | { kind: 'text'; content: string; contentType: 'html' | 'text'; format: DocumentFormat; warnings: string[] }
> {
  const format = detectFormat(filePath)

  if (format === 'docx') {
    const result = await readBinaryDocx(filePath)
    return { kind: 'binary', bytes: result.bytes, format, warnings: result.warnings }
  }

  if (format === 'doc') {
    const result = await readLegacyDoc(filePath)
    return { kind: 'binary', bytes: result.bytes, format, warnings: result.warnings }
  }

  const raw = await readFile(filePath, 'utf-8')
  if (format === 'html') {
    return { kind: 'text', content: raw, contentType: 'html', format, warnings: [] }
  }
  return { kind: 'text', content: raw, contentType: 'text', format, warnings: [] }
}

async function persistDocument(filePath: string, payload: SaveDocumentPayload): Promise<DocumentFormat> {
  const format = detectFormat(filePath)

  if (format === 'docx') {
    if (!payload.bytes) {
      throw new Error('Document bytes are required to save a .docx file.')
    }
    await writeFile(filePath, toNodeBuffer(payload.bytes))
    return format
  }

  if (format === 'html') {
    if (typeof payload.content !== 'string') {
      throw new Error('HTML content is required to save a web page.')
    }
    await writeFile(filePath, payload.content, 'utf-8')
    return format
  }

  if (extname(filePath).toLowerCase() === '.doc') {
    throw new Error('Saving to legacy .doc is not supported. Use .docx instead.')
  }

  const text = typeof payload.content === 'string' ? payload.content : ''
  await writeFile(filePath, text, 'utf-8')
  return 'txt'
}

async function requestTargetPath(
  event: Electron.IpcMainInvokeEvent,
  payload: SaveDocumentPayload,
  forceDialog: boolean
): Promise<string | null> {
  if (!forceDialog && payload.filePath) {
    return payload.filePath
  }

  const win = senderWindow(event)
  const saveOptions = {
    title: forceDialog ? 'Save As' : 'Save',
    defaultPath: payload.filePath ?? payload.defaultFileName ?? DEFAULT_FILE_NAME,
    filters: SAVE_DOCUMENT_FILTERS
  }
  const result = win
    ? await dialog.showSaveDialog(win, saveOptions)
    : await dialog.showSaveDialog(saveOptions)
  if (result.canceled || !result.filePath) {
    return null
  }
  return result.filePath
}

async function openDocumentHandler(
  event: Electron.IpcMainInvokeEvent,
  payload?: OpenDocumentPayload
): Promise<OpenDocumentResult> {
  let targetPath = payload?.filePath
  if (!targetPath) {
    const win = senderWindow(event)
    const openOptions: Electron.OpenDialogOptions = {
      title: 'Open',
      properties: ['openFile'],
      filters: OPEN_DOCUMENT_FILTERS
    }
    const result = win
      ? await dialog.showOpenDialog(win, openOptions)
      : await dialog.showOpenDialog(openOptions)
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }
    targetPath = result.filePaths[0]
  }

  try {
    const result = await readDocument(targetPath)
    updateRecentFile(targetPath)
    if (result.kind === 'binary') {
      return {
        canceled: false,
        filePath: targetPath,
        bytes: result.bytes,
        format: result.format,
        warnings: result.warnings
      }
    }
    return {
      canceled: false,
      filePath: targetPath,
      content: result.content,
      contentType: result.contentType,
      format: result.format,
      warnings: result.warnings
    }
  } catch (error) {
    return {
      canceled: false,
      filePath: targetPath,
      error: normalizeErrorMessage(error, 'Failed to open the selected document.')
    }
  }
}

async function saveDocumentHandler(
  event: Electron.IpcMainInvokeEvent,
  payload: SaveDocumentPayload,
  forceDialog: boolean
): Promise<SaveDocumentResult> {
  const targetPath = await requestTargetPath(event, payload, forceDialog)
  if (!targetPath) {
    return { canceled: true, persisted: false }
  }

  try {
    const format = await persistDocument(targetPath, payload)
    updateRecentFile(targetPath)
    return { canceled: false, persisted: true, filePath: targetPath, format }
  } catch (error) {
    return {
      canceled: false,
      persisted: false,
      filePath: targetPath,
      error: normalizeErrorMessage(error, 'Failed to save the document.')
    }
  }
}

async function printDocumentHandler(event: Electron.IpcMainInvokeEvent): Promise<PrintDocumentResult> {
  const win = senderWindow(event)
  if (!win) {
    return { success: false, error: 'No active window available for printing.' }
  }

  return await new Promise<PrintDocumentResult>((resolve) => {
    win.webContents.print({ printBackground: true }, (success, failureReason) => {
      if (success) {
        resolve({ success: true })
        return
      }
      const canceled = failureReason.toLowerCase().includes('cancel')
      resolve({
        success: false,
        canceled,
        error: canceled ? undefined : failureReason || 'Print failed.'
      })
    })
  })
}

export function registerFileHandlers(): void {
  ipcMain.handle(
    'file:open-document',
    async (event, payload?: OpenDocumentPayload): Promise<OpenDocumentResult> =>
      openDocumentHandler(event, payload)
  )

  ipcMain.handle(
    'file:save-document',
    async (event, payload: SaveDocumentPayload): Promise<SaveDocumentResult> =>
      saveDocumentHandler(event, payload, false)
  )

  ipcMain.handle(
    'file:save-document-as',
    async (event, payload: SaveDocumentPayload): Promise<SaveDocumentResult> =>
      saveDocumentHandler(event, payload, true)
  )

  ipcMain.handle('file:print-document', async (event): Promise<PrintDocumentResult> =>
    printDocumentHandler(event)
  )

  ipcMain.handle('file:get-recent-files', (): string[] => getExistingRecentFiles())
  ipcMain.handle('file:clear-recent-files', (): void => writeRecentFiles([]))

  ipcMain.handle('file:open', async (event): Promise<OpenFileResult> => {
    const result = await openDocumentHandler(event)
    return { canceled: result.canceled, filePath: result.filePath }
  })

  ipcMain.handle('file:save', async (event, payload: SaveFilePayload): Promise<SaveFileResult> => {
    const result = await saveDocumentHandler(event, payload, false)
    return {
      canceled: result.canceled,
      filePath: result.filePath,
      persisted: result.persisted,
      error: result.error
    }
  })
}
