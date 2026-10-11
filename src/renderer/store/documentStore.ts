import { create } from 'zustand'
import type { Document } from '@eigenpal/docx-editor-core/types/document'

export type BackstageSection = 'new' | 'open' | 'save' | 'saveAs' | 'print' | 'recent'
export type DocumentOperation = 'new' | 'open' | 'save' | 'saveAs' | 'print' | 'recent'
export type DocumentFormat = 'docx' | 'doc' | 'html' | 'txt'

interface DocumentState {
  filePath: string | null
  displayName: string
  isDirty: boolean
  lastSavedAt: number | null
  recentFiles: string[]
  backstageOpen: boolean
  backstageSection: BackstageSection
  busyOperation: DocumentOperation | null
  statusMessage: string | null
  errorMessage: string | null
  /** Raw DOCX bytes for initial editor mount (null = empty document). */
  documentBuffer: ArrayBuffer | null | undefined
  /** Bumps when a full editor remount is required. */
  documentKey: number
  /** Parsed document for text/html imports (alternative to buffer). */
  importDocument: Document | null
  currentFormat: DocumentFormat

  openBackstage: (section?: BackstageSection) => void
  closeBackstage: () => void
  setBackstageSection: (section: BackstageSection) => void

  markDirty: () => void
  markClean: (filePath?: string | null) => void
  resetToNewDocument: () => void
  setDocumentPayload: (payload: {
    documentBuffer?: ArrayBuffer | null | undefined
    importDocument?: Document | null
    format?: DocumentFormat
  }) => void

  setRecentFiles: (paths: string[]) => void
  addRecentFile: (path: string) => void

  beginOperation: (operation: DocumentOperation) => void
  finishOperation: (message?: string | null) => void
  failOperation: (message: string) => void
  clearMessages: () => void
}

const DEFAULT_DOCUMENT_NAME = 'Document1'
const MAX_RECENT_FILES = 20

function getDisplayNameFromPath(path: string | null | undefined): string {
  if (!path) return DEFAULT_DOCUMENT_NAME
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? DEFAULT_DOCUMENT_NAME
}

export const useDocumentStore = create<DocumentState>((set) => ({
  filePath: null,
  displayName: DEFAULT_DOCUMENT_NAME,
  isDirty: false,
  lastSavedAt: null,
  recentFiles: [],
  backstageOpen: false,
  backstageSection: 'new',
  busyOperation: null,
  statusMessage: null,
  errorMessage: null,
  documentBuffer: null,
  documentKey: 0,
  importDocument: null,
  currentFormat: 'docx',

  openBackstage: (section) =>
    set((state) => ({
      backstageOpen: true,
      backstageSection: section ?? state.backstageSection,
      errorMessage: null
    })),
  closeBackstage: () => set({ backstageOpen: false }),
  setBackstageSection: (backstageSection) => set({ backstageSection, errorMessage: null }),

  markDirty: () => set((state) => (state.isDirty ? state : { isDirty: true })),
  markClean: (filePath) =>
    set((state) => {
      const normalizedPath = filePath === undefined ? state.filePath : filePath
      return {
        isDirty: false,
        filePath: normalizedPath ?? null,
        displayName: getDisplayNameFromPath(normalizedPath),
        lastSavedAt: Date.now()
      }
    }),
  resetToNewDocument: () =>
    set((state) => ({
      filePath: null,
      displayName: DEFAULT_DOCUMENT_NAME,
      isDirty: false,
      lastSavedAt: null,
      documentBuffer: null,
      importDocument: null,
      currentFormat: 'docx',
      documentKey: state.documentKey + 1
    })),
  setDocumentPayload: (payload) =>
    set((state) => ({
      documentBuffer: payload.documentBuffer ?? null,
      importDocument: payload.importDocument ?? null,
      currentFormat: payload.format ?? 'docx',
      documentKey: state.documentKey + 1
    })),

  setRecentFiles: (recentFiles) =>
    set({
      recentFiles: Array.from(new Set(recentFiles)).slice(0, MAX_RECENT_FILES)
    }),
  addRecentFile: (path) =>
    set((state) => ({
      recentFiles: [path, ...state.recentFiles.filter((value) => value !== path)].slice(
        0,
        MAX_RECENT_FILES
      )
    })),

  beginOperation: (busyOperation) => set({ busyOperation, statusMessage: null, errorMessage: null }),
  finishOperation: (statusMessage = null) => set({ busyOperation: null, statusMessage, errorMessage: null }),
  failOperation: (errorMessage) => set({ busyOperation: null, errorMessage }),
  clearMessages: () => set({ statusMessage: null, errorMessage: null })
}))

export function getDocumentTitle(state: Pick<DocumentState, 'displayName' | 'isDirty'>): string {
  const dirtySuffix = state.isDirty ? '*' : ''
  return `${state.displayName}${dirtySuffix} - WordClone`
}
