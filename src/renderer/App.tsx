import { useCallback, useEffect, useRef } from 'react'
import TitleBar from './components/chrome/TitleBar'
import StatusBar from './components/chrome/StatusBar'
import Ribbon from './components/ribbon/Ribbon'
import Ruler from './components/ruler/Ruler'
import PageCanvas from './components/editor/PageCanvas'
import WordEditor, { useWordEditor } from './components/editor/WordEditor'
import { usePageCount } from './components/editor/usePageCount'
import FindReplaceBar from './components/editor/FindReplaceBar'
import AiPanel from './components/ai/AiPanel'
import PlanPanel from './components/ai/PlanPanel'
import FileBackstage from './components/backstage/FileBackstage'
import { useUiStore } from './store/uiStore'
import { useAiStore } from './store/aiStore'
import { useDocumentStore } from './store/documentStore'
import { AgentController } from './ai/agent'
import { acceptAllSuggestions, rejectAllSuggestions } from './ai/suggestionService'
import {
  clearRecentFiles,
  createNewDocument,
  loadRecentFiles,
  openDocument,
  openDocumentAtPath,
  printDocument,
  saveDocument,
  saveDocumentAs,
  shouldCloseWindow
} from './services/documentService'
import { Check, XCircle } from 'lucide-react'

export default function App() {
  const editor = useWordEditor()
  const allowWindowCloseRef = useRef(false)
  const agentRef = useRef<AgentController | null>(null)
  const pageCount = usePageCount(editor)
  const zoom = useUiStore((s) => s.zoom)
  const showRuler = useUiStore((s) => s.showRuler)
  const showParagraphMarks = useUiStore((s) => s.showParagraphMarks)
  const findBarOpen = useUiStore((s) => s.findBarOpen)
  const pendingSuggestions = useAiStore((s) => s.pendingSuggestions)
  const togglePanel = useAiStore((s) => s.togglePanel)
  const markDirty = useDocumentStore((s) => s.markDirty)
  const backstageOpen = useDocumentStore((s) => s.backstageOpen)
  const openBackstage = useDocumentStore((s) => s.openBackstage)
  const closeBackstage = useDocumentStore((s) => s.closeBackstage)

  useEffect(() => {
    void loadRecentFiles()
  }, [])

  useEffect(() => {
    if (!editor) return
    const handleUpdate = () => markDirty()
    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, markDirty])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()

      if (e.ctrlKey && e.shiftKey && key === 'i') {
        e.preventDefault()
        togglePanel()
        return
      }

      if (key === 'escape' && backstageOpen) {
        e.preventDefault()
        closeBackstage()
        return
      }

      if (!e.ctrlKey || e.altKey || e.metaKey) return

      if (key === 'n') {
        e.preventDefault()
        void createNewDocument(editor)
        return
      }

      if (key === 'o') {
        e.preventDefault()
        void openDocument(editor)
        return
      }

      if (key === 's') {
        e.preventDefault()
        if (e.shiftKey) {
          void saveDocumentAs(editor)
        } else {
          void saveDocument(editor)
        }
        return
      }

      if (key === 'p') {
        e.preventDefault()
        void printDocument()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [backstageOpen, closeBackstage, editor, togglePanel])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowWindowCloseRef.current) return
      const aiState = useAiStore.getState()
      if (aiState.streaming) {
        event.preventDefault()
        event.returnValue = false
        return
      }
      if (shouldCloseWindow()) {
        allowWindowCloseRef.current = true
        return
      }
      event.preventDefault()
      event.returnValue = false
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const handleAcceptAll = () => {
    if (editor) acceptAllSuggestions(editor)
  }

  const handleRejectAll = () => {
    if (editor) rejectAllSuggestions(editor)
  }

  const handleImplementPlan = useCallback(
    (planId: string) => {
      if (!editor) return
      const plan = useAiStore.getState().plans[planId]
      if (!plan) return
      const agent = new AgentController(editor)
      agentRef.current = agent
      agent.runFromPlan(plan).catch((err) => {
        const store = useAiStore.getState()
        store.setStreaming(false)
        if (err instanceof Error && !err.message.includes('cancelled')) {
          store.addMessage({
            id: `msg_err_${Date.now()}`,
            role: 'assistant',
            content: `Error implementing plan: ${err.message}`,
            timestamp: Date.now()
          })
        }
      })
    },
    [editor]
  )

  const handleCloseRequest = useCallback(() => {
    if (!shouldCloseWindow()) return
    allowWindowCloseRef.current = true
    window.api?.window?.close()
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-chrome text-ink">
      <TitleBar editor={editor} onSave={saveDocument} onCloseRequest={handleCloseRequest} />

      {backstageOpen ? (
        <FileBackstage
          editor={editor}
          onClose={closeBackstage}
          onNew={createNewDocument}
          onOpen={openDocument}
          onOpenRecent={openDocumentAtPath}
          onSave={saveDocument}
          onSaveAs={saveDocumentAs}
          onPrint={printDocument}
          onClearRecent={clearRecentFiles}
        />
      ) : (
        <>
          <Ribbon editor={editor} onFileClick={() => openBackstage('new')} />
          {showRuler && <Ruler zoom={zoom} />}
          <div className="relative flex flex-1 min-h-0">
            <PlanPanel editor={editor} onImplementPlan={handleImplementPlan} />
            {findBarOpen && <FindReplaceBar editor={editor} />}
            <PageCanvas zoom={zoom} className={showParagraphMarks ? 'show-paragraph-marks' : ''}>
              <WordEditor editor={editor} />
              {pendingSuggestions.length > 0 && (
                <div className="pointer-events-auto absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-ribbon-border bg-white px-4 py-2 shadow-lg">
                  <span className="text-[12px] text-gray-600">
                    {pendingSuggestions.length} pending AI change
                    {pendingSuggestions.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={handleAcceptAll}
                    className="flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-[12px] text-white hover:bg-green-700"
                  >
                    <Check size={12} /> Accept All
                  </button>
                  <button
                    onClick={handleRejectAll}
                    className="flex items-center gap-1 rounded border border-red-300 px-3 py-1 text-[12px] text-red-600 hover:bg-red-50"
                  >
                    <XCircle size={12} /> Reject All
                  </button>
                </div>
              )}
            </PageCanvas>
            <AiPanel editor={editor} agentRef={agentRef} />
          </div>
          <StatusBar editor={editor} pageCount={pageCount} />
        </>
      )}
    </div>
  )
}
