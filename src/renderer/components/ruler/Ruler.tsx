import { DPI, PAGE_SIZES, inchToPx } from '../../lib/units'

/**
 * A lightweight horizontal ruler that mirrors the page width and one-inch
 * margins. It is decorative in Phase 1 (no draggable margin stops yet) but
 * scales with the zoom level to stay aligned with the page below.
 */
export default function Ruler({ zoom }: { zoom: number }) {
  const pageWidth = PAGE_SIZES.Letter.width
  const margin = inchToPx(1)
  const inchPx = DPI * zoom
  const scaledWidth = pageWidth * zoom
  const inches = Math.floor(pageWidth / DPI)
  const marks = Array.from({ length: inches + 1 }, (_, i) => i)

  return (
    <div className="flex shrink-0 justify-center border-b border-ribbon-border bg-canvas py-1">
      <div className="relative h-[18px] text-[9px] text-gray-500" style={{ width: scaledWidth }}>
        <div
          className="absolute inset-y-[3px] rounded-[1px] border border-gray-300 bg-white"
          style={{ left: margin * zoom, right: margin * zoom }}
        />
        {marks.map((i) => (
          <div
            key={i}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 tabular-nums"
            style={{ left: i * inchPx }}
          >
            {i}
          </div>
        ))}
      </div>
    </div>
  )
}
