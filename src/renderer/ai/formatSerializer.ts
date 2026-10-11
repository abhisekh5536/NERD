export interface InlineMarks {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  subscript?: boolean
  superscript?: boolean
  color?: string
  highlight?: string
  fontFamily?: string
  fontSize?: string
  link?: string
}

export interface FormattedRun {
  text: string
  marks?: InlineMarks
  /** 0-based start index in block flat text (when includeFormatting from read_blocks). */
  charStart?: number
  /** 0-based exclusive end index in block flat text. */
  charEnd?: number
}

export interface BlockStyle {
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  lineSpacing?: string
  paragraphShading?: string
  paragraphBorder?: string
  level?: number
}

export interface FormattedCell {
  text: string
  runs: FormattedRun[]
}
