import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

/**
 * Breakpoint-based column configuration for the responsive grid.
 * Matches Tailwind's default breakpoints and the existing grid classes:
 *   grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6
 */
const BREAKPOINT_COLUMNS = [
  { minWidth: 1280, columns: 6 }, // xl
  { minWidth: 1024, columns: 5 }, // lg
  { minWidth: 768, columns: 4 },  // md
  { minWidth: 640, columns: 3 },  // sm
  { minWidth: 0, columns: 2 },    // default
] as const

/** Card aspect ratio (Magic card dimensions: 488/680) plus space for controls below */
const CARD_ASPECT_RATIO = 488 / 680
const CONTROLS_HEIGHT_PX = 48
const GAP_PX = 16

function getColumnCount(containerWidth: number): number {
  for (const bp of BREAKPOINT_COLUMNS) {
    if (containerWidth >= bp.minWidth) {
      return bp.columns
    }
  }
  return 2
}

interface UseVirtualGridOptions<T> {
  items: T[]
  /** Estimated card height when container width is unknown. Used as fallback. */
  estimatedCardHeight?: number
}

interface UseVirtualGridResult<T> {
  /** Ref to attach to the scrollable container */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  /** Current column count based on container width */
  columnCount: number
  /** Total height of the virtualized content */
  totalHeight: number
  /** Virtual rows to render */
  virtualRows: Array<{
    index: number
    start: number
    size: number
    items: T[]
    /** Starting index in the flat items array for this row */
    startItemIndex: number
  }>
}

export function useVirtualGrid<T>({
  items,
  estimatedCardHeight = 280,
}: UseVirtualGridOptions<T>): UseVirtualGridResult<T> {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Observe container width for responsive column changes
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const columnCount = containerWidth > 0 ? getColumnCount(containerWidth) : 2
  const rowCount = Math.ceil(items.length / columnCount)

  // Calculate row height based on container width
  const estimateRowHeight = useCallback(() => {
    if (containerWidth <= 0) return estimatedCardHeight + CONTROLS_HEIGHT_PX + GAP_PX

    const cardWidth = (containerWidth - GAP_PX * (columnCount - 1)) / columnCount
    const cardImageHeight = cardWidth / CARD_ASPECT_RATIO
    return cardImageHeight + CONTROLS_HEIGHT_PX + GAP_PX
  }, [containerWidth, columnCount, estimatedCardHeight])

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: estimateRowHeight,
    overscan: 3,
  })

  const virtualRows = useMemo(() => {
    return virtualizer.getVirtualItems().map((virtualRow) => {
      const startIdx = virtualRow.index * columnCount
      const rowItems = items.slice(startIdx, startIdx + columnCount)
      return {
        index: virtualRow.index,
        start: virtualRow.start,
        size: virtualRow.size,
        items: rowItems,
        startItemIndex: startIdx,
      }
    })
  }, [virtualizer.getVirtualItems(), columnCount, items])

  return {
    scrollContainerRef,
    columnCount,
    totalHeight: virtualizer.getTotalSize(),
    virtualRows,
  }
}
