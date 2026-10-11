import type { RefObject } from 'react'
import { ArrowLeft, Clock, FilePlus2, FolderOpen, Printer, Save, SaveAll } from 'lucide-react'
import type { WordCloneEditorRef } from '../../editor/editorBridge'
import { useDocumentStore, type BackstageSection } from '../../store/documentStore'

interface FileBackstageProps {
  editorRef: RefObject<WordCloneEditorRef | null>
  onClose: () => void
  onNew: (editorRef: RefObject<WordCloneEditorRef | null>) => Promise<boolean>
  onOpen: (editorRef: RefObject<WordCloneEditorRef | null>) => Promise<boolean>
  onOpenRecent: (editorRef: RefObject<WordCloneEditorRef | null>, filePath: string) => Promise<boolean>
  onSave: (editorRef: RefObject<WordCloneEditorRef | null>) => Promise<boolean>
  onSaveAs: (editorRef: RefObject<WordCloneEditorRef | null>) => Promise<boolean>
  onPrint: () => Promise<boolean>
  onClearRecent: () => Promise<void>
}

const MENU: { id: BackstageSection; label: string; icon: typeof FilePlus2 }[] = [
  { id: 'new', label: 'New', icon: FilePlus2 },
  { id: 'open', label: 'Open', icon: FolderOpen },
  { id: 'save', label: 'Save', icon: Save },
  { id: 'saveAs', label: 'Save As', icon: SaveAll },
  { id: 'print', label: 'Print', icon: Printer },
  { id: 'recent', label: 'Recent', icon: Clock }
]

export default function FileBackstage({
  editorRef,
  onClose,
  onNew,
  onOpen,
  onOpenRecent,
  onSave,
  onSaveAs,
  onPrint,
  onClearRecent
}: FileBackstageProps) {
  const section = useDocumentStore((s) => s.backstageSection)
  const setSection = useDocumentStore((s) => s.setBackstageSection)
  const busyOperation = useDocumentStore((s) => s.busyOperation)
  const statusMessage = useDocumentStore((s) => s.statusMessage)
  const errorMessage = useDocumentStore((s) => s.errorMessage)
  const recentFiles = useDocumentStore((s) => s.recentFiles)
  const displayName = useDocumentStore((s) => s.displayName)
  const isDirty = useDocumentStore((s) => s.isDirty)

  const busy = busyOperation != null

  return (
    <div className="backstage-root">
      <aside className="backstage-sidebar">
        <button type="button" className="backstage-back-btn" onClick={onClose}>
          <ArrowLeft size={16} /> Back
        </button>
        <nav className="backstage-menu">
          {MENU.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                'backstage-menu-item' + (section === item.id ? ' backstage-menu-item--active' : '')
              }
              onClick={() => setSection(item.id)}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="backstage-content">
        <header className="backstage-header">
          <h2>{MENU.find((m) => m.id === section)?.label ?? 'File'}</h2>
          <p>
            {displayName}
            {isDirty ? ' (unsaved changes)' : ''}
          </p>
        </header>

        {errorMessage && <div className="backstage-message backstage-message--error">{errorMessage}</div>}
        {statusMessage && !errorMessage && (
          <div className="backstage-message backstage-message--success">{statusMessage}</div>
        )}

        {section === 'new' && (
          <section className="backstage-section">
            <h3>Blank document</h3>
            <p>Start a new empty Word document with native OOXML editing.</p>
            <div className="backstage-actions">
              <button
                type="button"
                className="backstage-primary-btn"
                disabled={busy}
                onClick={() => void onNew(editorRef)}
              >
                Create blank document
              </button>
            </div>
          </section>
        )}

        {section === 'open' && (
          <section className="backstage-section">
            <h3>Open</h3>
            <p>Open an existing `.docx`, `.doc`, `.html`, or `.txt` file.</p>
            <div className="backstage-actions">
              <button
                type="button"
                className="backstage-primary-btn"
                disabled={busy}
                onClick={() => void onOpen(editorRef)}
              >
                Browse this PC
              </button>
            </div>
          </section>
        )}

        {section === 'save' && (
          <section className="backstage-section">
            <h3>Save</h3>
            <p>Save the current document to disk as OOXML (.docx).</p>
            <div className="backstage-actions">
              <button
                type="button"
                className="backstage-primary-btn"
                disabled={busy}
                onClick={() => void onSave(editorRef)}
              >
                Save
              </button>
            </div>
          </section>
        )}

        {section === 'saveAs' && (
          <section className="backstage-section">
            <h3>Save As</h3>
            <p>Save a copy under a new name or format.</p>
            <div className="backstage-actions">
              <button
                type="button"
                className="backstage-primary-btn"
                disabled={busy}
                onClick={() => void onSaveAs(editorRef)}
              >
                Save As
              </button>
            </div>
          </section>
        )}

        {section === 'print' && (
          <section className="backstage-section">
            <h3>Print</h3>
            <p>Print the paginated document layout.</p>
            <div className="backstage-actions">
              <button type="button" className="backstage-primary-btn" disabled={busy} onClick={() => void onPrint()}>
                Print
              </button>
            </div>
          </section>
        )}

        {section === 'recent' && (
          <section className="backstage-section">
            <div className="backstage-section-head">
              <h3>Recent</h3>
              <button type="button" className="backstage-secondary-btn" onClick={() => void onClearRecent()}>
                Clear list
              </button>
            </div>
            {recentFiles.length === 0 ? (
              <div className="backstage-empty-state">No recent files yet.</div>
            ) : (
              <ul className="backstage-recent-list">
                {recentFiles.map((path) => (
                  <li key={path}>
                    <button
                      type="button"
                      className="backstage-recent-item"
                      disabled={busy}
                      onClick={() => void onOpenRecent(editorRef, path)}
                    >
                      <span className="backstage-recent-item__name">{path.split(/[\\/]/).pop()}</span>
                      <span className="backstage-recent-item__path">{path}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
