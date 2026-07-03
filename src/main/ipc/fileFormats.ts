import { extname } from 'path'

export type DocumentFormat = 'docx' | 'doc' | 'html' | 'txt'

export function detectFormat(filePath: string): DocumentFormat {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.docx') return 'docx'
  if (extension === '.doc') return 'doc'
  if (extension === '.html' || extension === '.htm') return 'html'
  return 'txt'
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function textToHtml(value: string): string {
  const lines = value.split(/\r?\n/)
  return lines.map((line) => `<p>${escapeHtml(line) || '<br />'}</p>`).join('')
}

export function htmlToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
}

export function wrapHtmlDocument(htmlBody: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /></head><body>${htmlBody}</body></html>`
}
