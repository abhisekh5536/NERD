import { useEffect, useRef, useState, useCallback } from 'react'
import { Settings, X, Sparkles, Trash2, Check, XCircle } from 'lucide-react'
import type { Editor } from '@tiptap/core'
import { useAiStore } from '../../store/aiStore'
import { AgentController } from '../../ai/agent'
import {
  acceptSuggestion,
  rejectSuggestion,
  acceptAllSuggestions,
  rejectAllSuggestions
} from '../../ai/suggestionService'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import AssistantTimeline from './AssistantTimeline'
import ToolTimeline from './ToolTimeline'
import SettingsModal from './SettingsModal'
import CopyRawButton from './CopyRawButton'
import AgentRunStatusBar from './AgentRunStatusBar'
import SessionRecoveryBanner from './SessionRecoveryBanner'
import PlanTodosBar from './PlanTodosBar'
import { getModelLabel, getProviderInfo } from '../../../shared/models'
import { AgentSessionClient } from '../../ai/sessionClient'

interface Props {
  editor: Editor | null
  agentRef?: React.MutableRefObject<AgentController | null>
}

export default function AiPanel({ editor, agentRef: externalAgentRef }: Props) {
  const panelOpen = useAiStore((s) => s.panelOpen)
  const panelWidth = useAiStore((s) => s.panelWidth)
  const messages = useAiStore((s) => s.messages)
  const streaming = useAiStore((s) => s.streaming)
  const streamBlocks = useAiStore((s) => s.streamBlocks)
  const activeTools = useAiStore((s) => s.activeTools)
  const pendingSuggestions = useAiStore((s) => s.pendingSuggestions)
  const hasApiKey = useAiStore((s) => s.hasApiKey)
  const provider = useAiStore((s) => s.provider)
  const modelName = useAiStore((s) => s.modelName)
  const streamingRaw = useAiStore((s) => s.streamingRaw)
  const activePlan = useAiStore((s) => s.activePlan)
  const pendingContinue = useAiStore((s) => s.pendingContinue)
  const pendingContinueSessionId = useAiStore((s) => s.pendingContinueSessionId)
  const clearMessages = useAiStore((s) => s.clearMessages)

  const [showSettings, setShowSettings] = useState(false)
  const [resizing, setResizing] = useState(false)
  const localAgentRef = useRef<AgentController | null>(null)
  const agentRef = externalAgentRef ?? localAgentRef
  const scrollRef = useRef<HTMLDivElement>(null)

  const pendingCount = pendingSuggestions.length

  useEffect(() => {
    window.api?.settings?.getConfig().then((cfg) => {
      const store = useAiStore.getState()
      store.setProvider(cfg.provider)
      store.setModelName(cfg.model)
      window.api?.settings?.hasApiKey(cfg.provider).then((has) => {
        store.setHasApiKey(has)
      })
    })
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamBlocks, streaming])

  const handleSend = useCallback(
    (message: string) => {
      if (!editor) return
      const agent = new AgentController(editor)
      agentRef.current = agent
      const mode = useAiStore.getState().agentMode
      agent.run(message, { mode }).catch((err) => {
        const store = useAiStore.getState()
        store.setStreaming(false)
        if (err instanceof Error && !err.message.includes('cancelled')) {
          store.addMessage({
            id: `msg_err_${Date.now()}`,
            role: 'assistant',
            content: `Error: ${err.message}`,
            timestamp: Date.now()
          })
        }
      })
    },
    [editor]
  )

  const handleCancel = useCallback(() => {
    const store = useAiStore.getState()
    if (agentRef.current) {
      agentRef.current.cancel()
      return
    }
    const sessionId = store.activeSessionId
    if (sessionId) {
      store.setRunStats({
        ...store.runStats,
        statusLabel: 'Stopping…'
      })
      store.setStreaming(false)
      void window.api.agent.cancel(sessionId)
    } else {
      store.setStreaming(false)
    }
  }, [agentRef])

  const handleContinue = useCallback(() => {
    if (!editor || !pendingContinueSessionId) return
    useAiStore.getState().setPendingContinue(false, null)
    void AgentSessionClient.resume(pendingContinueSessionId, editor)
  }, [editor, pendingContinueSessionId])

  const handleAcceptSuggestion = useCallback(
    (id: string) => {
      if (editor) acceptSuggestion(editor, id)
    },
    [editor]
  )

  const handleRejectSuggestion = useCallback(
    (id: string) => {
      if (editor) rejectSuggestion(editor, id)
    },
    [editor]
  )

  const handleAcceptAll = useCallback(() => {
    if (editor) acceptAllSuggestions(editor)
  }, [editor])

  const handleRejectAll = useCallback(() => {
    if (editor) rejectAllSuggestions(editor)
  }, [editor])

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setResizing(true)
      const startX = e.clientX
      const startWidth = panelWidth

      const handleMove = (ev: MouseEvent) => {
        const delta = startX - ev.clientX
        useAiStore.getState().setPanelWidth(Math.max(280, Math.min(800, startWidth + delta)))
      }

      const handleUp = () => {
        setResizing(false)
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [panelWidth]
  )

  if (!panelOpen) return null

  const modelLabel = getModelLabel(provider, modelName)
  const providerLabel = getProviderInfo(provider).label

  return (
    <>
      <div
        className={`relative flex h-full flex-col border-l border-ribbon-border bg-white ${resizing ? 'select-none' : ''}`}
        style={{ width: panelWidth, minWidth: 280 }}
      >
        <div
          className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize"
          onMouseDown={handleResizeStart}
        />

        <div className="flex items-center justify-between border-b border-ribbon-border bg-chrome px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Sparkles size={15} className="text-word-accent" />
            <span className="text-[13px] font-semibold">AI Copilot</span>
            <span className="rounded-full bg-word-accent/10 px-2 py-0.5 text-[10px] font-medium text-word-accent">
              {modelLabel}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => clearMessages()}
              className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600"
              title="Clear chat"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600"
              title="Settings"
            >
              <Settings size={14} />
            </button>
            <button
              onClick={() => useAiStore.getState().setPanelOpen(false)}
              className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600"
              title="Close panel"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {activePlan?.todos && activePlan.todos.length > 0 && (
            <PlanTodosBar
              todos={activePlan.todos}
              planTitle={activePlan.title}
              planStatus={activePlan.status}
              className="sticky top-0 z-10 shrink-0"
            />
          )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <SessionRecoveryBanner editor={editor} />
          {pendingContinue && !streaming && (
            <div className="mx-3 mt-2 flex justify-center">
              <button
                type="button"
                onClick={handleContinue}
                className="rounded-full bg-word-accent px-4 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
              >
                Continue agent
              </button>
            </div>
          )}
          {messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <Sparkles size={32} className="mb-3 text-word-accent/40" />
                <p className="text-[13px] text-gray-500">
                  {hasApiKey
                    ? 'Ask me anything about your document. I can read, write, edit, and format it for you.'
                    : `Set your ${providerLabel} API key in Settings to get started.`}
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onAcceptSuggestion={handleAcceptSuggestion}
                onRejectSuggestion={handleRejectSuggestion}
              />
            ))}

            {streaming && (
              <div className="border-t border-ribbon-border/50 py-2">
                <div className="flex justify-end px-3 pb-1">
                  {streamingRaw && <CopyRawButton raw={streamingRaw} />}
                </div>
                {activeTools.length > 0 && <ToolTimeline tools={activeTools} />}
                <AssistantTimeline
                  blocks={streamBlocks}
                  streaming
                  onAcceptSuggestion={handleAcceptSuggestion}
                  onRejectSuggestion={handleRejectSuggestion}
                />
              </div>
            )}
          </div>
        </div>

        {pendingCount >= 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-ribbon-border bg-chrome/50 px-3 py-2">
            <button
              onClick={handleAcceptAll}
              className="flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-[12px] text-white hover:bg-green-700"
            >
              <Check size={12} /> Accept All ({pendingCount})
            </button>
            <button
              onClick={handleRejectAll}
              className="flex items-center gap-1 rounded border border-red-300 px-3 py-1 text-[12px] text-red-600 hover:bg-red-50"
            >
              <XCircle size={12} /> Reject All
            </button>
          </div>
        )}

        <AgentRunStatusBar />

        <ChatInput
          streaming={streaming}
          disabled={!hasApiKey}
          onSend={handleSend}
          onCancel={handleCancel}
        />
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  )
}
