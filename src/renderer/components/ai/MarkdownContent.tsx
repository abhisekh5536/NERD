import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface Props {
  content: string
  streaming?: boolean
  className?: string
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-1.5 text-[13px] leading-relaxed text-ink last:mb-0">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="text-[13px] leading-relaxed text-ink">{children}</li>,
  h1: ({ children }) => (
    <h1 className="mb-1.5 text-[15px] font-semibold text-ink">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 text-[14px] font-semibold text-ink">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 text-[13px] font-semibold text-ink">{children}</h3>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className={`block font-mono text-[12px] ${className ?? ''}`} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded bg-chrome px-1 py-0.5 font-mono text-[12px] text-ink"
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-1.5 max-h-40 overflow-auto rounded border border-ribbon-border bg-chrome/60 p-2">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-ribbon-border pl-2 text-[13px] text-gray-600">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-word-accent hover:underline"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-2 border-ribbon-border" />
}

export default function MarkdownContent({ content, streaming, className = '' }: Props) {
  if (!content.trim() && !streaming) return null

  return (
    <div className={`chat-markdown text-ink ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-word-accent" />
      )}
    </div>
  )
}
