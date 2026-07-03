import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'

interface StyleGalleryProps {
  editor: Editor | null
}

interface StyleCard {
  id: string
  label: string
  preview: string
  previewClassName: string
  apply: (editor: Editor) => void
}

const STYLE_CARDS: StyleCard[] = [
  {
    id: 'normal',
    label: 'Normal',
    preview: 'AaBbCcDd',
    previewClassName: 'style-card__preview--normal',
    apply: (editor) => {
      editor.chain().focus().setParagraph().setLineSpacing('1.15').run()
    }
  },
  {
    id: 'noSpacing',
    label: 'No Spacing',
    preview: 'No Spacing',
    previewClassName: 'style-card__preview--no-spacing',
    apply: (editor) => {
      editor.chain().focus().setParagraph().setLineSpacing('1').run()
    }
  },
  {
    id: 'heading1',
    label: 'Heading 1',
    preview: 'Heading 1',
    previewClassName: 'style-card__preview--heading1',
    apply: (editor) => {
      editor.chain().focus().setHeading({ level: 1 }).run()
    }
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    preview: 'Heading 2',
    previewClassName: 'style-card__preview--heading2',
    apply: (editor) => {
      editor.chain().focus().setHeading({ level: 2 }).run()
    }
  },
  {
    id: 'title',
    label: 'Title',
    preview: 'Title',
    previewClassName: 'style-card__preview--title',
    apply: (editor) => {
      editor.chain().focus().setHeading({ level: 1 }).setColor('#2f5496').run()
    }
  }
]

function scrollCards(container: HTMLDivElement | null, direction: 'left' | 'right'): void {
  if (!container) return
  container.scrollBy({ left: direction === 'left' ? -92 : 92, behavior: 'smooth' })
}

export default function StyleGallery({ editor }: StyleGalleryProps) {
  const disabled = !editor
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const active = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) {
        return {
          paragraph: false,
          h1: false,
          h2: false,
          color: ''
        }
      }
      return {
        paragraph: editor.isActive('paragraph'),
        h1: editor.isActive('heading', { level: 1 }),
        h2: editor.isActive('heading', { level: 2 }),
        color: (editor.getAttributes('textStyle').color as string | undefined) ?? ''
      }
    }
  })

  useEffect(() => {
    const container = scrollerRef.current
    if (!container) return

    const updateScrollState = (): void => {
      setCanScrollLeft(container.scrollLeft > 0)
      setCanScrollRight(container.scrollLeft + container.clientWidth < container.scrollWidth - 2)
    }

    updateScrollState()
    container.addEventListener('scroll', updateScrollState)
    window.addEventListener('resize', updateScrollState)
    return () => {
      container.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [editor])

  const isCardActive = (id: string): boolean => {
    if (id === 'normal' || id === 'noSpacing') return Boolean(active?.paragraph)
    if (id === 'title') return Boolean(active?.h1) && active?.color === '#2f5496'
    if (id === 'heading1') return Boolean(active?.h1) && active?.color !== '#2f5496'
    if (id === 'heading2') return Boolean(active?.h2)
    return false
  }

  return (
    <div className="flex h-full items-center gap-1">
      <button
        type="button"
        className="app-no-drag style-gallery__arrow"
        onClick={() => scrollCards(scrollerRef.current, 'left')}
        disabled={!canScrollLeft}
        title="Previous styles"
      >
        <ChevronLeft size={14} />
      </button>
      <div ref={scrollerRef} className="style-gallery__scroller">
        {STYLE_CARDS.map((style) => (
          <button
            key={style.id}
            type="button"
            className={`app-no-drag style-card ${isCardActive(style.id) ? 'style-card--active' : ''}`}
            disabled={disabled}
            onClick={() => {
              if (!editor) return
              style.apply(editor)
            }}
            title={style.label}
          >
            <span className={`style-card__preview ${style.previewClassName}`}>{style.preview}</span>
            <span className="style-card__label">{style.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="app-no-drag style-gallery__arrow"
        onClick={() => scrollCards(scrollerRef.current, 'right')}
        disabled={!canScrollRight}
        title="More styles"
      >
        <ChevronRight size={14} />
      </button>
      <button type="button" className="app-no-drag style-gallery__expand" title="Open styles pane">
        <MoreHorizontal size={13} />
      </button>
    </div>
  )
}
