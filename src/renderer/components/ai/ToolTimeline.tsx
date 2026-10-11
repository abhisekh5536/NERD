import { Loader2, CheckCircle2, XCircle, Wrench } from 'lucide-react'
import type { ToolCallEvent } from '../../ai/types'

const TOOL_LABELS: Record<string, string> = {
  get_table_of_contents: 'Reading table of contents',
  get_available_styles: 'Reading color palette',
  get_document_outline: 'Reading outline',
  read_blocks: 'Reading blocks',
  read_section: 'Reading section',
  read_selection: 'Reading selection',
  search_document: 'Searching',
  replace_block: 'Editing block',
  insert_block: 'Inserting content',
  insert_blocks: 'Inserting content',
  batch_edit: 'Applying edits',
  insert_list: 'Inserting list',
  insert_table: 'Inserting table',
  insert_image: 'Inserting image',
  delete_blocks: 'Deleting blocks',
  format_text: 'Formatting',
  apply_style: 'Changing style',
  insert_page_break: 'Adding page break',
  set_page_setup: 'Changing page setup',
  set_page_numbers: 'Setting page numbers',
  submit_plan: 'Submitting plan'
}

function labelForTool(name: string, args: Record<string, unknown>): string {
  if (name === 'format_text') {
    const scope = (args.scope as string) || 'text'
    if (scope === 'block') return 'Formatting block(s)'
    if (scope === 'range') return 'Formatting range'
    if (scope === 'run') return 'Formatting run'
    return 'Formatting text'
  }
  if (name === 'replace_block') {
    if (args.startOffset !== undefined && args.endOffset !== undefined) return 'Patching block (range)'
    if (args.oldText !== undefined) return 'Patching block'
    return 'Replacing block'
  }
  if (name === 'apply_style' && args.blockStyle && !args.style) return 'Block layout'
  return TOOL_LABELS[name] ?? name
}

export default function ToolTimeline({ tools }: { tools: ToolCallEvent[] }) {
  if (tools.length === 0) return null

  return (
    <div className="mx-3 my-1 flex flex-wrap gap-1">
      {tools.map((tc) => (
        <div
          key={tc.id}
          className="flex items-center gap-1 rounded-full border border-ribbon-border bg-chrome px-2 py-0.5 text-[11px]"
          title={`${tc.name}(${JSON.stringify(tc.args).slice(0, 100)})`}
        >
          {tc.status === 'running' ? (
            <Loader2 size={11} className="animate-spin text-word-accent" />
          ) : tc.status === 'done' ? (
            <CheckCircle2 size={11} className="text-green-600" />
          ) : (
            <XCircle size={11} className="text-red-500" />
          )}
          <Wrench size={10} className="text-gray-400" />
          {labelForTool(tc.name, tc.args)}
        </div>
      ))}
    </div>
  )
}
