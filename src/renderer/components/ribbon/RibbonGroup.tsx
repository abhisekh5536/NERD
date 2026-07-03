import type { ReactNode } from 'react'

interface RibbonGroupProps {
  title: string
  children: ReactNode
}

/** A labeled ribbon group: controls on top, a centered caption + divider below. */
export default function RibbonGroup({ title, children }: RibbonGroupProps) {
  return (
    <div className="flex h-full flex-col border-r border-ribbon-border px-2 pb-1 pt-1.5">
      <div className="flex flex-1 items-center gap-0.5">{children}</div>
      <div className="mt-1 text-center text-[11px] text-gray-500">{title}</div>
    </div>
  )
}
