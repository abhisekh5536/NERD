const MAX_LABEL_CHARS = 60

function truncate(text: string, max = MAX_LABEL_CHARS): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function blockTypeLabel(type: string): string {
  if (type === 'paragraph') return 'Paragraph'
  if (type === 'blockquote') return 'Quote'
  if (type.startsWith('heading')) {
    const level = parseInt(type.replace('heading', ''), 10) || 1
    return `H${level}`
  }
  return type
}

function previewText(text: string, emptyFallback: string): string {
  const preview = truncate(text)
  return preview || emptyFallback
}

export type DerivableEditTool =
  | 'replace_block'
  | 'insert_block'
  | 'insert_list'
  | 'delete_blocks'
  | 'insert_table'
  | 'insert_image'
  | 'insert_page_break'

export function deriveSuggestionDescription(
  toolName: DerivableEditTool,
  args: Record<string, unknown>
): string {
  switch (toolName) {
    case 'replace_block': {
      if (args.oldText !== undefined) {
        const oldText = (args.oldText as string) ?? ''
        return `Patch → ${previewText(oldText, 'Empty')}`
      }
      if (args.startOffset !== undefined && args.endOffset !== undefined) {
        return `Patch ${args.startOffset}-${args.endOffset}`
      }
      const text = (args.text as string) ?? ''
      return `Replace → ${previewText(text, 'Empty block')}`
    }

    case 'insert_block': {
      const type = (args.type as string) || 'paragraph'
      const text = (args.text as string) ?? ''
      const label = blockTypeLabel(type)
      const emptyFallback =
        type === 'paragraph'
          ? 'Empty paragraph'
          : type.startsWith('heading')
            ? 'Empty heading'
            : `Empty ${label.toLowerCase()}`
      return `${label}: ${previewText(text, emptyFallback)}`
    }

    case 'insert_list': {
      const listType = (args.listType as string) || 'bulletList'
      const items = (args.items as string[]) ?? []
      const kind = listType === 'orderedList' ? 'Numbered list' : 'Bullet list'
      const count = items.length
      const first = items[0]?.trim() ?? ''
      if (!count) return `${kind} (0)`
      const preview = first ? truncate(first, 40) : 'Empty item'
      return `${kind} (${count}): ${preview}`
    }

    case 'delete_blocks': {
      const blockIds = (args.blockIds as string[]) ?? []
      const count = blockIds.length
      return count === 1 ? 'Delete 1 block' : `Delete ${count} blocks`
    }

    case 'insert_table': {
      const rows = Math.max(1, (args.rows as number) ?? 3)
      const cols = Math.max(1, (args.cols as number) ?? 3)
      return `Table ${rows}×${cols}`
    }

    case 'insert_image': {
      const alt = ((args.alt as string) ?? '').trim()
      if (alt) return `Image: ${truncate(alt)}`
      return 'Insert image'
    }

    case 'insert_page_break':
      return 'Page break'

    default:
      return 'Edit'
  }
}
