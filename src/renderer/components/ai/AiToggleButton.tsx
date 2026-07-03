import { Sparkles } from 'lucide-react'
import { useAiStore } from '../../store/aiStore'

export default function AiToggleButton() {
  const panelOpen = useAiStore((s) => s.panelOpen)
  const togglePanel = useAiStore((s) => s.togglePanel)

  return (
    <button
      type="button"
      onClick={togglePanel}
      className={
        'app-no-drag ml-auto flex h-8 items-center gap-1.5 rounded-[3px] px-3 text-[13px] transition-colors ' +
        (panelOpen
          ? 'bg-word-accent text-white'
          : 'text-word-accent hover:bg-word-accent/10')
      }
      title="Toggle AI Copilot (Ctrl+Shift+I)"
    >
      <Sparkles size={15} />
      Copilot
    </button>
  )
}
