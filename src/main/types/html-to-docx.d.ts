declare module 'html-to-docx' {
  export default function htmlToDocx(
    htmlString: string,
    headerHtmlString?: string | null,
    documentOptions?: Record<string, unknown>,
    footerHtmlString?: string | null
  ): Promise<Buffer | { arrayBuffer: () => Promise<ArrayBuffer> }>
}
