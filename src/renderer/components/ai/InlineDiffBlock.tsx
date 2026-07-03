import { Check, FileEdit } from 'lucide-react'
import type { TimelineSuggestion } from '../../ai/types'

interface Props {
  suggestion: TimelineSuggestion
  onAccept?: (id: string) => void
  onReject?: (id: string) => void
}

function stripHtml(html: string): string {
  if (!html) return ''
  return html.replace(/<[^>]*>?/gm, '')
}

export default function InlineDiffBlock({ suggestion, onAccept, onReject }: Props) {
  const { status } = suggestion
  const isPending = status === 'pending'

  return (
    <div
      className={`mx-3 my-1 overflow-hidden rounded border text-[12px] ${
        status === 'accepted'
          ? 'border-green-200 bg-green-50/40 opacity-80'
          : status === 'rejected'
            ? 'border-gray-200 bg-gray-50 opacity-60'
            : 'border-ribbon-border bg-white'
      }`}
    >
      <div className="flex items-center gap-2 border-b border-ribbon-border/60 px-2.5 py-1.5">
        <FileEdit size={12} className="shrink-0 text-word-accent" />
        <span className="min-w-0 flex-1 truncate font-medium text-gray-800">
          {suggestion.description}
        </span>
        {status === 'accepted' && (
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-green-700">
            <Check size={10} /> Applied
          </span>
        )}
        {status === 'rejected' && (
          <span className="shrink-0 text-[10px] font-medium text-gray-500">Rejected</span>
        )}
        {isPending && onAccept && onReject && (
          <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => onAccept(suggestion.id)}
              className="text-green-700 hover:underline"
            >
              Accept
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={() => onReject(suggestion.id)}
              className="text-red-600 hover:underline"
            >
              Reject
            </button>
          </span>
        )}
      </div>
      {(suggestion.originalHtml || suggestion.newHtml) && (
        <div className="max-h-28 overflow-auto px-2.5 py-1.5 font-mono text-[11px] leading-relaxed">
          {suggestion.originalHtml && (
            <div className="mb-0.5 rounded bg-red-50 px-1.5 py-0.5 text-red-800 line-through">
              {stripHtml(suggestion.originalHtml).slice(0, 180)}
              {stripHtml(suggestion.originalHtml).length > 180 ? '…' : ''}
            </div>
          )}
          {suggestion.newHtml && (
            <div className="rounded bg-green-50 px-1.5 py-0.5 text-green-800">
              {stripHtml(suggestion.newHtml).slice(0, 180)}
              {stripHtml(suggestion.newHtml).length > 180 ? '…' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
