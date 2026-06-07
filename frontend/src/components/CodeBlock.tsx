import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeBlockProps {
  language: string
  value: string
}

export default function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be unavailable; ignore
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-slate-700">
      <div className="flex items-center justify-between bg-slate-800/80 px-3 py-1 text-xs text-slate-400">
        <span className="font-mono">{language}</span>
        <button type="button" onClick={copy} className="transition hover:text-slate-200">
          {copied ? 'Kopyalandı ✓' : 'Kopyala'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{ margin: 0, background: '#0f172a', fontSize: '0.8rem', padding: '0.75rem' }}
        wrapLongLines
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
}
