import type { WordCloneEditorRef, RibbonFormatState } from '../../editor/editorBridge'
import { useUiStore, type RibbonTabId } from '../../store/uiStore'
import { useDocumentStore } from '../../store/documentStore'
import HomeTab from './HomeTab'
import InsertTab from './tabs/InsertTab'
import LayoutTab from './tabs/LayoutTab'
import ReviewTab from './tabs/ReviewTab'
import ViewTab from './tabs/ViewTab'
import AiToggleButton from '../ai/AiToggleButton'

const TABS: { id: RibbonTabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'layout', label: 'Layout' },
  { id: 'review', label: 'Review' },
  { id: 'view', label: 'View' }
]

interface RibbonProps {
  editor: WordCloneEditorRef | null
  formatState: RibbonFormatState | null
  onFileClick: () => void
}

export default function Ribbon({ editor, formatState, onFileClick }: RibbonProps) {
  const activeTab = useUiStore((s) => s.activeTab)
  const setActiveTab = useUiStore((s) => s.setActiveTab)
  const backstageOpen = useDocumentStore((s) => s.backstageOpen)

  return (
    <div className="flex flex-col border-b border-ribbon-border bg-ribbon">
      <div className="app-drag flex h-9 items-end gap-1 px-2">
        <button
          type="button"
          onClick={onFileClick}
          className={
            'app-no-drag mb-1 rounded-[3px] px-3 py-1 text-[13px] font-medium text-white ' +
            (backstageOpen ? 'bg-word-accent-hover' : 'bg-word-accent hover:bg-word-accent-hover')
          }
        >
          File
        </button>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={
                'app-no-drag h-8 rounded-t-[3px] px-3 text-[13px] transition-colors ' +
                (isActive
                  ? 'border-x border-t border-ribbon-border bg-ribbon font-medium text-word-accent'
                  : 'text-ink hover:bg-black/5')
              }
            >
              {tab.label}
            </button>
          )
        })}
        <AiToggleButton />
      </div>

      <div className="h-[98px] overflow-visible border-t border-ribbon-border bg-ribbon px-2 py-1">
        {activeTab === 'home' && <HomeTab editor={editor} formatState={formatState} />}
        {activeTab === 'insert' && <InsertTab editor={editor} />}
        {activeTab === 'layout' && <LayoutTab editor={editor} />}
        {activeTab === 'review' && <ReviewTab editor={editor} />}
        {activeTab === 'view' && <ViewTab />}
      </div>
    </div>
  )
}
