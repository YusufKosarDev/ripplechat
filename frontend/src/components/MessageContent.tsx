import { lazy, Suspense } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

// Lazy-loaded so the heavy syntax highlighter is fetched only when a message
// actually contains a code block (keeps the initial bundle small).
const CodeBlock = lazy(() => import('./CodeBlock'))

// No rehype-raw: raw HTML in messages is NOT rendered (escaped), so user content
// cannot inject markup/scripts — safe by default.
const components: Components = {
  pre: ({ children }) => <>{children}</>,
  code({ className, children }) {
    const text = String(children)
    const match = /language-(\w+)/.exec(className ?? '')
    const isBlock = Boolean(match) || text.includes('\n')
    if (isBlock) {
      const value = text.replace(/\n$/, '')
      return (
        <Suspense
          fallback={
            <pre className="my-2 overflow-x-auto rounded-lg border border-control bg-surface-muted p-3 font-mono text-xs text-fg-secondary">
              {value}
            </pre>
          }
        >
          <CodeBlock language={match?.[1] ?? 'text'} value={value} />
        </Suspense>
      )
    }
    return (
      <code className="rounded-lg bg-surface-muted px-2 py-0.5 font-mono text-xs text-accent">
        {children}
      </code>
    )
  },
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 hover:text-accent-hover"
    >
      {children}
    </a>
  ),
  p: ({ children }) => <p className="whitespace-pre-wrap break-words">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-0.5 pl-5">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-control pl-3 text-fg-muted">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-fg">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
}

interface MessageContentProps {
  content: string
}

export default function MessageContent({ content }: MessageContentProps) {
  return (
    <div className="space-y-1 text-sm leading-relaxed text-fg-secondary">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
