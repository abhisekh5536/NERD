import { useContext, useEffect } from 'react'
import { DropdownAnchorContext } from './DropdownMenu'
import { HIGHLIGHT_COLORS } from '../../lib/editorStyles'

interface HighlightPickerMenuProps {
  open: boolean
  onClose: () => void
  selectedColor?: string | null
  onSelect: (color: string) => void
  onClear: () => void
}

export default function HighlightPickerMenu({
  open,
  onClose,
  selectedColor,
  onSelect,
  onClear
}: HighlightPickerMenuProps) {
  const anchorRef = useContext(DropdownAnchorContext)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      const root = anchorRef?.current
      if (root?.contains(target)) return
      onClose()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  const normalizedSelected = selectedColor?.toLowerCase()

  return (
    <div
      className="app-no-drag absolute top-full left-0 z-50 mt-1 rounded border border-ribbon-border bg-white p-2 shadow-lg"
      role="menu"
      aria-label="Highlight color picker"
    >
      <div className="grid grid-cols-5 border border-black/20" style={{ gap: 0 }}>
        {HIGHLIGHT_COLORS.map((color) => {
          const isSelected = normalizedSelected === color.toLowerCase()
          return (
            <button
              key={color}
              type="button"
              role="menuitem"
              title={color}
              aria-label={`Select highlight color ${color}`}
              aria-pressed={isSelected}
              onClick={() => {
                onSelect(color)
                onClose()
              }}
              className={`h-6 w-6 transition-shadow hover:ring-2 hover:ring-word-accent/60 ${
                isSelected ? 'ring-2 ring-word-accent z-10 relative' : ''
              }`}
              style={{ backgroundColor: color }}
            />
          )
        })}
      </div>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClear()
          onClose()
        }}
        className="mt-2 flex w-full items-center gap-2 px-1 py-1 text-left text-[12px] text-ink hover:bg-black/6"
      >
        <span className="flex h-4 w-4 items-center justify-center border border-black/15 bg-white">
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="red" strokeWidth="1.5">
            <line x1="0" y1="10" x2="10" y2="0" />
            <circle cx="5" cy="5" r="4.5" fill="none" />
          </svg>
        </span>
        <span>No Color</span>
      </button>
    </div>
  )
}
