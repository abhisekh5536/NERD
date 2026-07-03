import { useContext, useEffect } from 'react'
import { DropdownAnchorContext } from './DropdownMenu'
import { THEME_COLORS_TOP, THEME_COLORS_SHADES, STANDARD_COLORS } from '../../lib/editorStyles'

interface FontColorPickerMenuProps {
  open: boolean
  onClose: () => void
  selectedColor?: string | null
  onSelect: (color: string) => void
  onClear?: () => void
  clearLabel?: string
}

export default function FontColorPickerMenu({
  open,
  onClose,
  selectedColor,
  onSelect,
  onClear,
  clearLabel = 'No Color'
}: FontColorPickerMenuProps) {
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

  const renderColor = (color: string, withBorder = false) => {
    const isSelected = normalizedSelected === color.toLowerCase()
    return (
      <button
        key={color}
        type="button"
        role="menuitem"
        title={color}
        aria-pressed={isSelected}
        onClick={() => {
          onSelect(color)
          onClose()
        }}
        className={`h-3.5 w-3.5 hover:ring-1 hover:ring-black hover:z-10 relative ${
          isSelected ? 'ring-1 ring-word-accent z-10' : ''
        } ${withBorder ? 'border border-black/20' : ''}`}
        style={{ backgroundColor: color }}
      />
    )
  }

  return (
    <div
      className="app-no-drag absolute top-full left-0 z-50 mt-1 rounded border border-ribbon-border bg-white shadow-lg w-[160px]"
      role="menu"
      aria-label="Color picker"
    >
      <div className="p-2 pb-1">
        <div className="text-[11px] text-ink font-semibold mb-1.5">Theme Colors</div>
        <div className="flex gap-[2px]">
          {THEME_COLORS_TOP.map((color) => (
            <div key={color} className="flex flex-col">
              {renderColor(color, true)}
            </div>
          ))}
        </div>
        
        <div className="flex gap-[2px] mt-[2px]">
          {THEME_COLORS_TOP.map((_, colIndex) => (
            <div key={colIndex} className="flex flex-col">
              {THEME_COLORS_SHADES[colIndex]!.map((shadeColor) => renderColor(shadeColor, false))}
            </div>
          ))}
        </div>
      </div>

      <div className="p-2 pt-1">
        <div className="text-[11px] text-ink font-semibold mb-1.5 mt-1">Standard Colors</div>
        <div className="flex gap-[2px]">
          {STANDARD_COLORS.map((color) => renderColor(color, true))}
        </div>
      </div>

      {onClear ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClear()
            onClose()
          }}
          className="flex w-full items-center px-2 py-1 text-left text-[12px] text-ink hover:bg-black/6 border-t border-ribbon-border"
        >
          <span>{clearLabel}</span>
        </button>
      ) : null}
    </div>
  )
}
