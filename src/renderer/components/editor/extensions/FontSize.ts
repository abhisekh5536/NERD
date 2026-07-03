import { Extension } from '@tiptap/core'

export interface FontSizeOptions {
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /** Set the font size, e.g. "12pt" or "16px". */
      setFontSize: (size: string) => ReturnType
      /** Remove an explicit font size and fall back to the stylesheet default. */
      unsetFontSize: () => ReturnType
    }
  }
}

/**
 * Adds a `fontSize` attribute to the `textStyle` mark. TipTap v2's TextStyle
 * does not ship font-size out of the box, so we layer it on the same mark to
 * keep the document model clean (one mark, multiple style attributes).
 */
export const FontSize = Extension.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle']
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            }
          }
        }
      }
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
    }
  }
})
