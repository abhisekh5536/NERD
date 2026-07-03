import { Ruler as RulerIcon, ZoomIn, ZoomOut } from 'lucide-react'
import RibbonGroup from '../RibbonGroup'
import RibbonButton from '../RibbonButton'
import { useUiStore } from '../../../store/uiStore'

/** The View tab is functional in Phase 1: it drives ruler visibility and zoom. */
export default function ViewTab() {
  const showRuler = useUiStore((s) => s.showRuler)
  const toggleRuler = useUiStore((s) => s.toggleRuler)
  const zoom = useUiStore((s) => s.zoom)
  const zoomIn = useUiStore((s) => s.zoomIn)
  const zoomOut = useUiStore((s) => s.zoomOut)
  const resetZoom = useUiStore((s) => s.resetZoom)

  return (
    <div className="flex h-full items-stretch">
      <RibbonGroup title="Show">
        <label className="app-no-drag flex cursor-pointer items-center gap-1.5 px-2 text-[12px]">
          <input type="checkbox" checked={showRuler} onChange={toggleRuler} />
          <RulerIcon size={16} strokeWidth={1.8} />
          Ruler
        </label>
      </RibbonGroup>
      <RibbonGroup title="Zoom">
        <RibbonButton icon={ZoomOut} title="Zoom Out" onClick={zoomOut} />
        <RibbonButton
          label={`${Math.round(zoom * 100)}%`}
          title="Reset to 100%"
          onClick={resetZoom}
        />
        <RibbonButton icon={ZoomIn} title="Zoom In" onClick={zoomIn} />
      </RibbonGroup>
    </div>
  )
}
