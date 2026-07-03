import type { ReactNode } from 'react'

interface PageCanvasProps {
  zoom: number
  className?: string
  children: ReactNode
}

/**
 * Scrollable gray document area. The page itself is rendered (and sized) by the
 * editor + pagination plugin; here we only provide the surrounding canvas and
 * apply the current zoom level.
 */
export default function PageCanvas({ zoom, className, children }: PageCanvasProps) {
  return (
    <div className={`editor-canvas ${className ?? ''}`}>
      <div className="editor-canvas__zoom" style={{ transform: `scale(${zoom})` }}>
        {children}
      </div>
    </div>
  )
}
