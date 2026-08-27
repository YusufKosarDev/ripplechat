import { useState, useEffect } from 'react'
import { useT } from '../i18n'
// Async-light build: the highlighter core is small and each language grammar is
// loaded on demand, instead of the full Prism build bundling every language.
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark'
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light'
import { useAppSelector } from '../app/hooks'
import { focusRing } from './ui/focusRing'

/**
 * Fence shorthand → the key PrismAsyncLight's loader map actually uses.
 *
 * The loader map is keyed by canonical names ("javascript", "python"), while
 * people type the alias ("js", "py"). An unknown key silently loads no grammar
 * and the block renders as plain text — which is what every ```js block in the
 * app did before this map existed.
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  vue: 'markup',
  cs: 'csharp',
  'c++': 'cpp',
  golang: 'go',
  kt: 'kotlin',
  rs: 'rust',
  ps1: 'powershell',
  dockerfile: 'docker',
  tf: 'hcl',
  psql: 'sql',
}

interface CodeBlockProps {
  language: string
  value: string
}

export default function CodeBlock({ language, value }: CodeBlockProps) {
  const { t } = useT()
  const theme = useAppSelector((state) => state.ui.theme)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // clipboard may be unavailable; ignore
    }
  }

  const dark = theme === 'dark'
  // The label keeps whatever the author typed; only the lookup is normalised.
  const grammar = LANGUAGE_ALIASES[language.toLowerCase()] ?? language.toLowerCase()

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-control">
      <div className="flex items-center justify-between bg-surface-muted px-3 py-1 text-xs text-fg-muted">
        <span className="font-mono">{language}</span>
        <button type="button" onClick={copy} className={`rounded-lg transition hover:text-fg ${focusRing}`}>
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
      <SyntaxHighlighter
        language={grammar}
        style={dark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          background: dark ? '#0f172a' : '#f8fafc',
          fontSize: '0.8rem',
          padding: '0.75rem',
        }}
        wrapLongLines
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
}
