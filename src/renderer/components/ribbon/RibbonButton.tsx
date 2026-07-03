import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'

interface RibbonButtonProps {
  icon?: LucideIcon
  label?: string
  title?: string
  active?: boolean
  disabled?: boolean
  variant?: 'icon' | 'large' | 'dropdown'
  colorIndicator?: string
  onClick?: () => void
}

const base =
  'app-no-drag flex items-center justify-center rounded-[3px] text-ink transition-colors ' +
  'hover:bg-black/[0.06] active:bg-black/[0.12] disabled:opacity-40 disabled:hover:bg-transparent'

export default function RibbonButton({
  icon: Icon,
  label,
  title,
  active = false,
  disabled = false,
  variant = 'icon',
  colorIndicator,
  onClick
}: RibbonButtonProps) {
  const activeClass = active ? 'bg-[#cce4f7] hover:bg-[#cce4f7]' : ''

  const handleClick = (): void => {
    if (!disabled) onClick?.()
  }

  if (variant === 'large') {
    return (
      <button
        type="button"
        title={title ?? label}
        aria-pressed={active}
        disabled={disabled}
        onClick={handleClick}
        className={`${base} ${activeClass} h-full min-w-[56px] flex-col gap-1 px-2 py-1`}
      >
        {Icon ? <Icon size={28} strokeWidth={1.6} /> : null}
        {label ? <span className="text-[11px] leading-tight">{label}</span> : null}
      </button>
    )
  }

  if (variant === 'dropdown') {
    return (
      <button
        type="button"
        title={title ?? label}
        aria-pressed={active}
        aria-label={title ?? label}
        disabled={disabled}
        onClick={handleClick}
        className={`${base} ${activeClass} relative h-7 gap-1 px-1.5`}
      >
        {Icon ? <Icon size={16} strokeWidth={1.8} /> : null}
        {label ? <span className="text-[12px]">{label}</span> : null}
        <ChevronDown size={12} strokeWidth={1.8} />
        {colorIndicator ? (
          <span
            className="absolute bottom-0 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-sm"
            style={{ backgroundColor: colorIndicator }}
            aria-hidden="true"
          />
        ) : null}
      </button>
    )
  }

  return (
    <button
      type="button"
      title={title ?? label}
      aria-pressed={active}
      aria-label={title ?? label}
      disabled={disabled}
      onClick={handleClick}
      className={`${base} ${activeClass} relative h-7 gap-1 px-1.5`}
    >
      {Icon ? <Icon size={16} strokeWidth={1.8} /> : null}
      {label ? <span className="text-[12px]">{label}</span> : null}
      {colorIndicator ? (
        <span
          className="absolute bottom-0 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-sm"
          style={{ backgroundColor: colorIndicator }}
          aria-hidden="true"
        />
      ) : null}
    </button>
  )
}
