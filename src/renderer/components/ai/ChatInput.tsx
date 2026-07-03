import { useState, useRef, useCallback } from 'react'
import { Send, StopCircle, ChevronDown } from 'lucide-react'
import { useAiStore } from '../../store/aiStore'
import type { AgentMode } from '../../ai/types'

interface Props {
  streaming: boolean
  disabled: boolean
  onSend: (message: string) => void
  onCancel: () => void
}

export default function ChatInput({ streaming, disabled, onSend, onCancel }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const agentMode = useAiStore((s) => s.agentMode)
  const setAgentMode = useAiStore((s) => s.setAgentMode)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || streaming || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [value, streaming, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }

  const chipBase =
    'flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors'
  const chipActive = 'bg-word-accent/15 text-word-accent font-medium'

  const placeholder =
    agentMode === 'plan'
      ? disabled
        ? 'Set your API key in Settings first...'
        : "Describe what you want to change — I'll create a plan first..."
      : disabled
        ? 'Set your API key in Settings first...'
        : 'Ask anything about your document...'

  return (
    <div className="border-t border-ribbon-border bg-white p-2.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        <div className="relative">
          <select
            value={agentMode}
            onChange={(e) => setAgentMode(e.target.value as AgentMode)}
            disabled={streaming}
            className={`${chipBase} ${chipActive} appearance-none border-0 pr-5 outline-none`}
            title="Agent mode: direct edits. Plan mode: create a plan first."
          >
            <option value="agent">Agent</option>
            <option value="plan">Plan</option>
          </select>
          <ChevronDown
            size={10}
            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-word-accent"
          />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          className="flex-1 resize-none rounded border border-ribbon-border px-2.5 py-1.5 text-[13px] outline-none placeholder:text-gray-400 focus:border-word-accent"
          rows={1}
          placeholder={placeholder}
          value={value}
          disabled={disabled || streaming}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
        />
        {streaming ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded bg-red-500 text-white hover:bg-red-600"
            title="Stop generation"
          >
            <StopCircle size={16} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="flex h-8 w-8 items-center justify-center rounded bg-word-accent text-white hover:bg-word-accent-hover disabled:opacity-40"
            title="Send (Enter)"
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
