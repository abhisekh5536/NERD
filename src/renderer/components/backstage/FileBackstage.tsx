import type { ComponentType } from 'react'
import type { Editor } from '@tiptap/core'
import {
  ArrowLeft,
  FilePlus2,
  FolderOpen,
  Save,
  SaveAll,
  Printer,
  Clock4,
  FileText,
  Trash2
} from 'lucide-react'
import { useDocumentStore, type BackstageSection } from '../../store/documentStore'

interface FileBackstageProps {
  editor: Editor | null
  onClose: () => void
  onNew: (editor: Editor | null) => Promise<boolean>
  onOpen: (editor: Editor | null) => Promise<boolean>
  onOpenRecent: (editor: Editor | null, filePath: string) => Promise<boolean>
  onSave: (editor: Editor | null) => Promise<boolean>
  onSaveAs: (editor: Editor | null) => Promise<boolean>
  onPrint: () => Promise<boolean>
  onClearRecent: () => Promise<void>
}

type MenuItem = {
  id: BackstageSection
  label: string
  icon: ComponentType<{ size?: number; className?: string }>
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'new', label: 'New', icon: FilePlus2 },
  { id: 'open', label: 'Open', icon: FolderOpen },
  { id: 'save', label: 'Save', icon: Save },
  { id: 'saveAs', label: 'Save As', icon: SaveAll },
  { id: 'print', label: 'Print', icon: Printer },
  { id: 'recent', label: 'Recent', icon: Clock4 }
]

function fileNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

function RecentList({
  recentFiles,
  onOpenRecent,
  disabled
}: {
  recentFiles: string[]
  onOpenRecent: (path: string) => void
  disabled: boolean
}) {
  if (recentFiles.length === 0) {
    return (
      <div className="backstage-empty-state">
        <FileText size={20} />
        <p>No recent files yet.</p>
      </div>
    )
  }

  return (
    <div className="backstage-recent-list">
      {recentFiles.map((path) => (
        <button
          key={path}
          type="button"
          disabled={disabled}
          className="backstage-recent-item"
          onClick={() => onOpenRecent(path)}
          title={path}
        >
          <FileText size={16} className="text-word-accent" />
          <span className="backstage-recent-item__name">{fileNameFromPath(path)}</span>
          <span className="backstage-recent-item__path">{path}</span>
        </button>
      ))}
    </div>
  )
}

export default function FileBackstage({
  editor,
  onClose,
  onNew,
  onOpen,
  onOpenRecent,
  onSave,
  onSaveAs,
  onPrint,
  onClearRecent
}: FileBackstageProps) {
  const backstageSection = useDocumentStore((s) => s.backstageSection)
  const setBackstageSection = useDocumentStore((s) => s.setBackstageSection)
  const displayName = useDocumentStore((s) => s.displayName)
  const filePath = useDocumentStore((s) => s.filePath)
  const recentFiles = useDocumentStore((s) => s.recentFiles)
  const busyOperation = useDocumentStore((s) => s.busyOperation)
  const statusMessage = useDocumentStore((s) => s.statusMessage)
  const errorMessage = useDocumentStore((s) => s.errorMessage)

  const busy = busyOperation !== null

  const runNew = () => void onNew(editor)
  const runOpen = () => void onOpen(editor)
  const runSave = () => void onSave(editor)
  const runSaveAs = () => void onSaveAs(editor)
  const runPrint = () => void onPrint()
  const runOpenRecent = (path: string) => void onOpenRecent(editor, path)
  const runClearRecent = () => void onClearRecent()

  return (
    <div className="backstage-root">
      <aside className="backstage-sidebar">
        <button type="button" className="backstage-back-btn" onClick={onClose}>
          <ArrowLeft size={16} />
          <span>Back to document</span>
        </button>

        <div className="backstage-menu">
          {MENU_ITEMS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              className={`backstage-menu-item ${backstageSection === id ? 'backstage-menu-item--active' : ''}`}
              onClick={() => setBackstageSection(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="backstage-content">
        <header className="backstage-header">
          <h2>{MENU_ITEMS.find((item) => item.id === backstageSection)?.label ?? 'File'}</h2>
          <p>
            {filePath ? `Current file: ${filePath}` : 'Current file: Unsaved document'}
          </p>
        </header>

        {errorMessage && <div className="backstage-message backstage-message--error">{errorMessage}</div>}
        {!errorMessage && statusMessage && (
          <div className="backstage-message backstage-message--success">{statusMessage}</div>
        )}

        {backstageSection === 'new' && (
          <section className="backstage-section">
            <h3>Start a new document</h3>
            <div className="backstage-template-grid">
              <button type="button" disabled={busy} className="backstage-template" onClick={runNew}>
                <FilePlus2 size={24} />
                <span>Blank document</span>
              </button>
              <div className="backstage-template backstage-template--disabled">
                <FileText size={24} />
                <span>Report template</span>
              </div>
              <div className="backstage-template backstage-template--disabled">
                <FileText size={24} />
                <span>Letter template</span>
              </div>
            </div>
          </section>
        )}

        {backstageSection === 'open' && (
          <section className="backstage-section">
            <h3>Open a document</h3>
            <div className="backstage-actions">
              <button type="button" disabled={busy} className="backstage-primary-btn" onClick={runOpen}>
                <FolderOpen size={16} />
                Browse this PC
              </button>
            </div>
            <h4>Recent files</h4>
            <RecentList recentFiles={recentFiles} onOpenRecent={runOpenRecent} disabled={busy} />
          </section>
        )}

        {backstageSection === 'save' && (
          <section className="backstage-section">
            <h3>Save document</h3>
            <p>{`Save changes to ${displayName}.`}</p>
            <div className="backstage-actions">
              <button type="button" disabled={busy} className="backstage-primary-btn" onClick={runSave}>
                <Save size={16} />
                Save
              </button>
            </div>
          </section>
        )}

        {backstageSection === 'saveAs' && (
          <section className="backstage-section">
            <h3>Save document as</h3>
            <p>Create a new copy and choose a different location or format.</p>
            <div className="backstage-actions">
              <button type="button" disabled={busy} className="backstage-primary-btn" onClick={runSaveAs}>
                <SaveAll size={16} />
                Save As
              </button>
            </div>
          </section>
        )}

        {backstageSection === 'print' && (
          <section className="backstage-section">
            <h3>Print</h3>
            <p>Open the native print dialog for this document.</p>
            <div className="backstage-actions">
              <button type="button" disabled={busy} className="backstage-primary-btn" onClick={runPrint}>
                <Printer size={16} />
                Print
              </button>
            </div>
          </section>
        )}

        {backstageSection === 'recent' && (
          <section className="backstage-section">
            <div className="backstage-section-head">
              <h3>Recent files</h3>
              <button
                type="button"
                disabled={busy || recentFiles.length === 0}
                className="backstage-secondary-btn"
                onClick={runClearRecent}
              >
                <Trash2 size={14} />
                Clear recent
              </button>
            </div>
            <RecentList recentFiles={recentFiles} onOpenRecent={runOpenRecent} disabled={busy} />
          </section>
        )}
      </main>
    </div>
  )
}
