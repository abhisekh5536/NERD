/** CSS reference pixel density. Browsers render 1in = 96px regardless of screen DPI. */
export const DPI = 96

export const inchToPx = (inches: number): number => Math.round(inches * DPI)
export const mmToPx = (mm: number): number => Math.round((mm / 25.4) * DPI)
export const pxToInch = (px: number): number => px / DPI
/** Typographic points: 72pt = 1in. */
export const ptToPx = (pt: number): number => (pt / 72) * DPI

export interface PageGeometry {
  width: number
  height: number
}

/** Page sizes in CSS pixels at 96dpi. */
export const PAGE_SIZES = {
  Letter: { width: inchToPx(8.5), height: inchToPx(11) },
  A4: { width: mmToPx(210), height: mmToPx(297) }
} satisfies Record<string, PageGeometry>

export type PageSizeName = keyof typeof PAGE_SIZES

const PAGE_SIZE_ALIASES: Record<string, PageSizeName> = {
  letter: 'Letter',
  a4: 'A4'
}

/** Resolve user/model input like "letter", "LETTER", "A4" to a known page size. */
export function resolvePageSize(name: string | undefined): PageGeometry | null {
  if (!name) return null
  const trimmed = name.trim()
  const direct = PAGE_SIZES[trimmed as PageSizeName]
  if (direct) return direct
  const alias = PAGE_SIZE_ALIASES[trimmed.toLowerCase()]
  return alias ? PAGE_SIZES[alias] : null
}
