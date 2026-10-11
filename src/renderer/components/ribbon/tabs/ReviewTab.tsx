import type { WordCloneEditorRef } from '../../../editor/editorBridge'
import { useCallback } from 'react'
import { acceptAllSuggestions, rejectAllSuggestions } from '../../../ai/suggestionService'
import RibbonGroup from '../RibbonGroup'
import RibbonButton from '../RibbonButton'
import { useAiStore } from '../../../store/aiStore'
import { useUiStore } from '../../../store/uiStore'
import {
  SpellCheck,
  Hash,
  MessageSquare,
  History,
  Search,
  Languages,
  Check,
  XCircle,
  FileText
} from 'lucide-react'

interface ReviewTabProps {
  editor: WordCloneEditorRef | null
}

export default function ReviewTab({ editor }: ReviewTabProps) {
  const openFindBar = useUiStore((s) => s.openFindBar)
  const pendingSuggestions = useAiStore((s) => s.pendingSuggestions)

  const handleAcceptAll = useCallback(() => {
    if (editor) acceptAllSuggestions(editor)
  }, [editor])

  const handleRejectAll = useCallback(() => {
    if (editor) rejectAllSuggestions(editor)
  }, [editor])

  const handleWordCount = useCallback(() => {
    if (!editor) return
    try {
      const agent = editor.getAgent()
      const text = agent?.getText() ?? ''
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      const chars = text.length
      const paras = text.split(/\n\s*\n/).filter(Boolean).length
      alert(`Words: ${words}\nCharacters: ${chars}\nParagraphs: ${paras}`)
    } catch {
      alert('Could not compute word count.')
    }
  }, [editor])

  const hasSuggestions = pendingSuggestions.length > 0

  return (
    <div className="flex h-full items-stretch">
      <RibbonGroup title="Proofing">
        <RibbonButton
          icon={SpellCheck}
          label="Spelling"
          title="Check Spelling"
          disabled
        />
        <RibbonButton
          icon={Hash}
          label="Word Count"
          title="Word Count"
          onClick={handleWordCount}
          disabled={!editor}
        />
        <RibbonButton
          icon={Languages}
          label="Language"
          title="Set Proofing Language"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Thesaurus"
          title="Thesaurus (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Comments">
        <RibbonButton
          icon={MessageSquare}
          label="New Comment"
          title="New Comment (not implemented)"
          disabled
        />
        <RibbonButton
          icon={MessageSquare}
          label="Delete"
          title="Delete Comment (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Previous"
          title="Previous Comment (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Next"
          title="Next Comment (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Show Comments"
          title="Show Comments (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Tracking">
        <RibbonButton
          icon={History}
          label="Track Changes"
          title="Track Changes (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Show Markup"
          title="Show Markup (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Reviewing Pane"
          title="Reviewing Pane (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Changes">
        <RibbonButton
          icon={FileText}
          label="Previous"
          title="Previous Change (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Next"
          title="Next Change (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="AI Suggestions">
        <RibbonButton
          icon={Check}
          label="Accept All"
          title="Accept all AI suggestions"
          onClick={handleAcceptAll}
          disabled={!editor || !hasSuggestions}
          active={hasSuggestions}
        />
        <RibbonButton
          icon={XCircle}
          label="Reject All"
          title="Reject all AI suggestions"
          onClick={handleRejectAll}
          disabled={!editor || !hasSuggestions}
        />
      </RibbonGroup>

      <RibbonGroup title="Compare">
        <RibbonButton
          icon={FileText}
          label="Compare"
          title="Compare Documents (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Combine"
          title="Combine Documents (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Protect">
        <RibbonButton
          icon={FileText}
          label="Restrict Editing"
          title="Restrict Editing (not implemented)"
          disabled
        />
      </RibbonGroup>

      <RibbonGroup title="Find">
        <RibbonButton
          icon={Search}
          label="Find"
          title="Find in Document"
          onClick={() => openFindBar()}
          disabled={!editor}
        />
        <RibbonButton
          icon={Search}
          label="Advanced Find"
          title="Advanced Find (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Replace"
          title="Replace (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Go To"
          title="Go To (not implemented)"
          disabled
        />
        <RibbonButton
          icon={FileText}
          label="Select"
          title="Select (not implemented)"
          disabled
        />
      </RibbonGroup>
    </div>
  )
}