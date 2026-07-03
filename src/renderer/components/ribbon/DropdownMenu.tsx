import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject
} from 'react'
import type { LucideIcon } from 'lucide-react'

export interface DropdownItem {
  id: string
  label: string
  icon?: LucideIcon
  disabled?: boolean
  active?: boolean
  onSelect: () => void
}

export const DropdownAnchorContext = createContext<RefObject<HTMLElement | null> | null>(null)

/** Wraps a ribbon dropdown trigger + menu so outside-click detection includes the button. */
export function MenuTrigger({
  open,
  children
}: {
  open: boolean
  children: ReactNode
}) {
  const anchorRef = useRef<HTMLDivElement>(null)

  return (
    <DropdownAnchorContext.Provider value={anchorRef}>
      <div ref={anchorRef} className={`relative ${open ? 'z-50' : ''}`}>
        {children}
      </div>
    </DropdownAnchorContext.Provider>
  )
}

interface DropdownMenuProps {
  open: boolean
  onClose: () => void
  items: DropdownItem[]
  minWidthClassName?: string
}

export default function DropdownMenu({
  open,
  onClose,
  items,
  minWidthClassName = 'min-w-[180px]'
}: DropdownMenuProps) {
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

  return (
    <div
      className={`app-no-drag absolute top-full left-0 z-50 mt-1 rounded border border-ribbon-border bg-white py-1 shadow-lg ${minWidthClassName}`}
      role="menu"
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              item.onSelect()
              onClose()
            }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-ink hover:bg-black/6 disabled:opacity-40 ${
              item.active ? 'bg-[#cce4f7]' : ''
            }`}
          >
            {Icon ? <Icon size={14} strokeWidth={1.8} /> : null}
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
