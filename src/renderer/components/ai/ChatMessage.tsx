import { User, Bot } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from '../../ai/types'
import { rawLlmResponseFromMessage } from '../../ai/rawResponse'
import ThoughtStream from './ThoughtStream'
import ToolTimeline from './ToolTimeline'
import CopyRawButton from './CopyRawButton'
import AssistantTimeline from './AssistantTimeline'
import MarkdownContent from './MarkdownContent'

interface Props {
  message: ChatMessageType
  onAcceptSuggestion?: (id: string) => void
  onRejectSuggestion?: (id: string) => void
}

export default function ChatMessage({
  message,
  onAcceptSuggestion,
  onRejectSuggestion
}: Props) {
  const isUser = message.role === 'user'
  const raw = !isUser ? rawLlmResponseFromMessage(message) : null
  const hasBlocks = !isUser && message.blocks && message.blocks.length > 0

  return (
    <div className={`px-3 py-2 ${isUser ? '' : 'bg-chrome/30'}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isUser ? (
            <User size={14} className="text-gray-500" />
          ) : (
            <Bot size={14} className="text-word-accent" />
          )}
          <span className="text-[11px] font-medium text-gray-500">
            {isUser ? 'You' : 'AI Copilot'}
          </span>
        </div>
        {raw && <CopyRawButton raw={raw} />}
      </div>

      {hasBlocks ? (
        <AssistantTimeline
          blocks={message.blocks!}
          onAcceptSuggestion={onAcceptSuggestion}
          onRejectSuggestion={onRejectSuggestion}
        />
      ) : isUser ? (
        <MarkdownContent content={message.content} className="text-[13px]" />
      ) : (
        <>
          {message.thoughts && <ThoughtStream thought={message.thoughts} />}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <ToolTimeline tools={message.toolCalls} />
          )}
          <MarkdownContent content={message.content} />
        </>
      )}
    </div>
  )
}
