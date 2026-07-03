/**
 * Gemini FunctionDeclaration[] for the agentic tool loop.
 * Uses parametersJsonSchema per @google/genai SDK recommendations.
 */

const emptySchema = { type: 'object', properties: {}, required: [] as string[] }

export const READ_TOOLS = [
  {
    name: 'get_table_of_contents',
    description:
      'Headings-only table of contents with blockIds and levels. Use first to find sections. Do not use when you already have the target blockIds.',
    parametersJsonSchema: emptySchema
  },
  {
    name: 'get_available_styles',
    description:
      'Returns hex color palettes (theme shades, standard, highlight). Call only when you need an exact theme/shade hex value.',
    parametersJsonSchema: emptySchema
  },
  {
    name: 'get_document_outline',
    description:
      'Full outline with body previews (large). Prefer get_table_of_contents for navigation; use after major edits when you need body-block previews.',
    parametersJsonSchema: emptySchema
  },
  {
    name: 'read_blocks',
    description:
      'Read up to 10 blocks by blockId. Returns text, runs, blockStyle, prevBlockId/nextBlockId. Use after search_document. Not for whole sections — use read_section instead.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        blockIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Block IDs to read (max 10)'
        },
        textOffset: {
          type: 'number',
          description: 'Char offset for truncated blocks (single blockId only)'
        },
        includeFormatting: {
          type: 'boolean',
          description: 'Include runs and blockStyle. Default true.'
        }
      },
      required: ['blockIds']
    }
  },
  {
    name: 'read_section',
    description:
      'Read contiguous blocks from startBlockId to endBlockId or next same-level heading. Use for chapters/sections. Max 25 blocks per call.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        startBlockId: {
          type: 'string',
          description: 'Section start (usually a heading blockId)'
        },
        endBlockId: {
          type: 'string',
          description: 'Optional explicit end blockId (exclusive boundary)'
        },
        maxBlocks: {
          type: 'number',
          description: 'Max blocks to return. Default 15, max 25.'
        },
        includeFormatting: {
          type: 'boolean',
          description: 'Include runs and blockStyle. Default true.'
        }
      },
      required: ['startBlockId']
    }
  },
  {
    name: 'read_selection',
    description:
      'Read full selected text with runs and blockStyle. Use when fingerprint shows selection or user refers to "this"/selected text.',
    parametersJsonSchema: emptySchema
  },
  {
    name: 'search_document',
    description:
      'Keyword search returning snippets and blockIds. Use short keywords; pass queries[] for synonyms. Follow with read_blocks or read_section.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Single keyword or short phrase' },
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: 'Up to 5 query variants (deduped)'
        },
        scope: {
          type: 'string',
          enum: ['all', 'headings', 'body'],
          description: 'Search scope. Default all.'
        },
        blockTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter: paragraph, heading, listItem, table, etc.'
        },
        caseSensitive: { type: 'boolean', description: 'Default false.' },
        maxResults: { type: 'number', description: 'Results per page. Default 20.' },
        offset: { type: 'number', description: 'Pagination offset. Default 0.' }
      },
      required: []
    }
  }
]

export const EDIT_TOOLS = [
  {
    name: 'replace_block',
    description:
      'Edit block text. Modes (mutually exclusive): (1) full — blockId + text rewrites entire block; (2) range — blockId + startOffset + endOffset + newText for in-block splice using offsets from read_blocks; (3) patch — blockId + oldText + newText (+ optional occurrence) for short phrase replace. Prefer range or patch over full. Use apply_style for block type. Do not pass description.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        blockId: { type: 'string', description: 'The blockId to edit' },
        text: {
          type: 'string',
          description: 'Full replacement plain text (full mode only). DO NOT use HTML.'
        },
        startOffset: {
          type: 'number',
          description: '0-based start char offset in block (range mode). From read_blocks runs.'
        },
        endOffset: {
          type: 'number',
          description: '0-based exclusive end char offset (range mode).'
        },
        newText: {
          type: 'string',
          description: 'Replacement text for range or patch mode. DO NOT use HTML.'
        },
        oldText: {
          type: 'string',
          description: 'Exact text to replace (patch mode). Must match block content.'
        },
        occurrence: {
          type: 'number',
          description: '1-based occurrence when oldText matches multiple times (patch mode). Default 1.'
        }
      },
      required: ['blockId']
    }
  },
  {
    name: 'insert_block',
    description:
      'Insert a new block (paragraph, heading, blockquote) after a given blockId. Returns blockId of the inserted block for chaining further inserts. Creates suggestion diffs. Do not pass a description — the app generates the suggestion label from your content.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        afterBlockId: {
          type: 'string',
          description:
            'Insert after this blockId (blk_*). Use "__start__" for document start. Never use suggestionId (sug_*). Chain inserts using blockId from the prior insert_block result.'
        },
        type: {
          type: 'string',
          description: 'Type of block to insert: "paragraph", "heading1", "heading2", "heading3", "blockquote"'
        },
        text: { type: 'string', description: 'Plain text content to insert. DO NOT use HTML.' }
      },
      required: ['afterBlockId', 'type', 'text']
    }
  },
  {
    name: 'insert_list',
    description:
      'Insert a new list (bullet or ordered) after a given blockId. Returns blockId of the inserted list for chaining. Creates suggestion diffs. Do not pass a description — the app generates the suggestion label from your content.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        afterBlockId: {
          type: 'string',
          description:
            'Insert after this blockId (blk_*). Use "__start__" for document start. Never use suggestionId (sug_*). Use blockId from a prior insert_block result.'
        },
        listType: { type: 'string', description: '"bulletList" or "orderedList"' },
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of plain text strings for each list item. DO NOT use HTML.'
        }
      },
      required: ['afterBlockId', 'listType', 'items']
    }
  },
  {
    name: 'delete_blocks',
    description:
      'Delete blocks by their blockIds. Creates suggestion diffs (strikethrough) that the user can reject to keep. Do not pass a description — the app generates the suggestion label from your content.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        blockIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of blockIds to delete'
        }
      },
      required: ['blockIds']
    }
  },
  {
    name: 'format_text',
    description:
      'Apply inline formatting (bold, italic, underline, color, font, highlight). scope: "block" (whole block(s) — blockId or blockIds[]), "range" (startOffset+endOffset from read_blocks), "run" (runIndex from read_blocks), "text" (searchText — short phrases only). For alignment/line spacing use apply_style blockStyle instead.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          description: '"block", "range", "run", or "text" (default "text")'
        },
        blockId: { type: 'string', description: 'Block containing the text' },
        blockIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Multiple blocks for scope "block" batch formatting'
        },
        searchText: { type: 'string', description: 'Exact text (scope "text" only). Keep short.' },
        startOffset: { type: 'number', description: '0-based start (scope "range")' },
        endOffset: { type: 'number', description: '0-based exclusive end (scope "range")' },
        runIndex: { type: 'number', description: '0-based run index from read_blocks (scope "run")' },
        occurrence: {
          type: 'number',
          description: '1-based match index when searchText appears multiple times (scope "text")'
        },
        formatting: {
          type: 'object',
          description: 'Inline formatting to apply',
          properties: {
            bold: { type: 'boolean' },
            italic: { type: 'boolean' },
            underline: { type: 'boolean' },
            strike: { type: 'boolean' },
            color: { type: 'string', description: 'CSS color value' },
            highlight: {
              type: 'string',
              description: 'Highlight color or "none" to clear'
            },
            fontFamily: { type: 'string' },
            fontSize: { type: 'string', description: 'e.g. "14pt"' }
          }
        }
      },
      required: ['formatting']
    }
  },
  {
    name: 'apply_style',
    description:
      'Change block type (paragraph, heading, list, quote) and/or paragraph blockStyle (textAlign, lineSpacing). Pass style for type changes and/or blockStyle for alignment/spacing — no text echo needed.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        blockId: { type: 'string' },
        style: {
          type: 'string',
          description:
            'Target type: "paragraph", "heading1", "heading2", "heading3", "bulletList", "orderedList", "blockquote"'
        },
        blockStyle: {
          type: 'object',
          description: 'Paragraph-level style without changing block type',
          properties: {
            textAlign: { type: 'string', description: 'left, center, right, or justify' },
            lineSpacing: { type: 'string', description: 'e.g. "1.5" or "2"' }
          }
        }
      },
      required: ['blockId']
    }
  },
  {
    name: 'insert_page_break',
    description: 'Insert a page break after the specified block.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        afterBlockId: { type: 'string', description: 'Insert page break after this block' }
      },
      required: ['afterBlockId']
    }
  },
  {
    name: 'insert_table',
    description:
      'Insert a table after the specified block. Do not pass a description — the app generates the suggestion label from your content.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        afterBlockId: { type: 'string', description: 'Insert table after this block' },
        rows: { type: 'number', description: 'Number of rows (default 3)' },
        cols: { type: 'number', description: 'Number of columns (default 3)' }
      },
      required: ['afterBlockId']
    }
  },
  {
    name: 'insert_image',
    description:
      'Insert an image after the specified block. Do not pass a description — the app generates the suggestion label from your content.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        afterBlockId: { type: 'string', description: 'Insert image after this block' },
        src: { type: 'string', description: 'Image URL or base64 data URI' },
        alt: { type: 'string', description: 'Alt text for accessibility' }
      },
      required: ['afterBlockId', 'src']
    }
  },
  {
    name: 'set_page_setup',
    description: 'Change the page layout: size, orientation, and margins. Affects the entire document.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'string', description: 'Page size: "Letter" or "A4"' },
        orientation: { type: 'string', description: '"portrait" or "landscape"' },
        margins: {
          type: 'object',
          description: 'Margins in inches',
          properties: {
            top: { type: 'number' },
            bottom: { type: 'number' },
            left: { type: 'number' },
            right: { type: 'number' }
          }
        }
      },
      required: []
    }
  },
  {
    name: 'set_page_numbers',
    description: 'Configure page number display in headers or footers.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        position: {
          type: 'string',
          description:
            '"footer-right", "footer-left", "footer-center", "header-right", "header-left", "header-center"'
        },
        format: {
          type: 'string',
          description: 'Format string using {page} and {total} placeholders, e.g. "Page {page} of {total}"'
        }
      },
      required: ['position', 'format']
    }
  }
]

export const SUBMIT_PLAN_TOOL = {
  name: 'submit_plan',
  description:
    'Required final step in plan mode. Call exactly once when ready. Submit the finalized implementation plan for user review — do not put the full plan in chat text.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short plan title' },
      overview: { type: 'string', description: '1-2 sentence summary of the planned changes' },
      plan: {
        type: 'string',
        description:
          'Full markdown implementation plan with Overview, Current State, Proposed Changes (with blockIds), Risks, and Test Checklist'
      },
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique todo id, e.g. todo-1' },
            content: { type: 'string', description: 'Todo description' }
          },
          required: ['id', 'content']
        },
        description: 'Ordered list of implementation steps'
      }
    },
    required: ['title', 'plan', 'todos']
  }
}

export const PLAN_TOOLS = [...READ_TOOLS, SUBMIT_PLAN_TOOL]

export const ALL_TOOLS = [...READ_TOOLS, ...EDIT_TOOLS]

