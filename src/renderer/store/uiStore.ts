import { create } from 'zustand'
import type { PageSizeName } from '../lib/units'

export type RibbonTabId = 'home' | 'insert' | 'layout' | 'review' | 'view'
export type FindBarMode = 'find' | 'replace'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const round1 = (n: number): number => Math.round(n * 10) / 10
const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

interface UiState {
  activeTab: RibbonTabId
  zoom: number
  pageFormat: PageSizeName
  showRuler: boolean
  showParagraphMarks: boolean
  findBarOpen: boolean
  findBarMode: FindBarMode
  formatPainterActive: boolean
  setActiveTab: (tab: RibbonTabId) => void
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  setPageFormat: (format: PageSizeName) => void
  toggleRuler: () => void
  toggleParagraphMarks: () => void
  openFindBar: (mode?: FindBarMode) => void
  closeFindBar: () => void
  setFindBarMode: (mode: FindBarMode) => void
  toggleFormatPainter: () => void
  setFormatPainterActive: (active: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'home',
  zoom: 1,
  pageFormat: 'Letter',
  showRuler: true,
  showParagraphMarks: false,
  findBarOpen: false,
  findBarMode: 'find',
  formatPainterActive: false,
  setActiveTab: (activeTab) => set({ activeTab }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomIn: () => set((state) => ({ zoom: clampZoom(round1(state.zoom + 0.1)) })),
  zoomOut: () => set((state) => ({ zoom: clampZoom(round1(state.zoom - 0.1)) })),
  resetZoom: () => set({ zoom: 1 }),
  setPageFormat: (pageFormat) => set({ pageFormat }),
  toggleRuler: () => set((state) => ({ showRuler: !state.showRuler })),
  toggleParagraphMarks: () => set((state) => ({ showParagraphMarks: !state.showParagraphMarks })),
  openFindBar: (mode = 'find') => set({ findBarOpen: true, findBarMode: mode }),
  closeFindBar: () => set({ findBarOpen: false }),
  setFindBarMode: (findBarMode) => set({ findBarMode }),
  toggleFormatPainter: () =>
    set((state) => ({ formatPainterActive: !state.formatPainterActive })),
  setFormatPainterActive: (formatPainterActive) => set({ formatPainterActive })
}))
