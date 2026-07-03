import { useCallback, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { RawLlmResponse } from '../../ai/types'
import { copyRawLlmResponse } from '../../ai/rawResponse'

interface Props {
  raw: RawLlmResponse
  className?: string
}

export default function CopyRawButton({ raw, className = '' }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await copyRawLlmResponse(raw)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }, [raw])

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy raw LLM response (JSON with metadata)"
      className={`inline-flex items-center gap-1 rounded border border-ribbon-border px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-black/5 hover:text-gray-700 ${className}`}
    >
      {copied ? (
        <>
          <Check size={11} className="text-green-600" /> Copied
        </>
      ) : (
        <>
          <Copy size={11} /> Copy raw
        </>
      )}
    </button>
  )
}
