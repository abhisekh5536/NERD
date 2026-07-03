import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'

/**
 * tiptap-pagination-plus renders one `.rm-page-break` element per page, so we
 * observe the editor DOM and count them. Cheaper and more accurate than
 * re-measuring content height on every keystroke.
 */
export function usePageCount(editor: Editor | null): number {
  const [pageCount, setPageCount] = useState(1)

  useEffect(() => {
    if (!editor) return

    const dom = editor.view.dom as HTMLElement
    const recount = (): void => {
      const breaks = dom.querySelectorAll('.rm-page-break').length
      setPageCount(Math.max(1, breaks))
    }

    recount()
    const observer = new MutationObserver(recount)
    observer.observe(dom, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [editor])

  return pageCount
}
