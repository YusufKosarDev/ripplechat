import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { useEffect } from 'react'
import { useT } from '../../i18n'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  onEnter: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  focusTrigger?: number
}

export function RichTextEditor({ value, onChange, onEnter, placeholder, className = '', autoFocus = false, focusTrigger = 0 }: RichTextEditorProps) {
  const { t } = useT()
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || t('editor.placeholder'),
        emptyEditorClass: 'is-editor-empty',
      }),
      Markdown,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none text-fg outline-none p-3 min-h-[44px] ${className}`,
      },
      handleKeyDown: (_view, event) => {
        // Shift+Enter = new line
        // Enter without Shift = Submit
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          onEnter()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      // Get markdown output
      const storage = (editor.storage as unknown) as Record<string, { getMarkdown: () => string }>
      const markdown = storage.markdown.getMarkdown()
      onChange(markdown)
    },
  })

  // Sync external value to internal state when external changes (e.g. cleared draft)
  useEffect(() => {
    if (editor) {
      const storage = (editor.storage as unknown) as Record<string, { getMarkdown: () => string }>
      if (value !== storage.markdown.getMarkdown()) {
        editor.commands.setContent(value)
      }
    }
  }, [value, editor])

  useEffect(() => {
    if (editor && (autoFocus || focusTrigger > 0)) {
      setTimeout(() => editor.commands.focus(), 0)
    }
  }, [editor, autoFocus, focusTrigger])

  if (!editor) {
    return null
  }

  return (
    <div className={`flex flex-col border border-border bg-surface-muted rounded-xl focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all ${className}`}>
      {/* Editor Content Area */}
      <div className="max-h-64 overflow-y-auto w-full text-base">
        <EditorContent editor={editor} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-surface/50 border-t border-border/50 rounded-b-xl overflow-x-auto">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('bold') ? 'text-accent bg-accent/10' : 'text-fg-muted'}`}
          title={t('editor.bold')}
        >
          <span className="font-bold px-1">B</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('italic') ? 'text-accent bg-accent/10' : 'text-fg-muted'}`}
          title={t('editor.italic')}
        >
          <span className="italic px-1">I</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('strike') ? 'text-accent bg-accent/10' : 'text-fg-muted'}`}
          title={t('editor.strike')}
        >
          <span className="line-through px-1">S</span>
        </button>
        <div className="w-px h-4 bg-border/50 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('code') ? 'text-accent bg-accent/10' : 'text-fg-muted'}`}
          title={t('editor.code')}
        >
          <span className="font-mono text-sm px-1">{'<>'}</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('codeBlock') ? 'text-accent bg-accent/10' : 'text-fg-muted'}`}
          title={t('editor.codeBlock')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
        </button>
        <div className="w-px h-4 bg-border/50 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('blockquote') ? 'text-accent bg-accent/10' : 'text-fg-muted'}`}
          title={t('editor.quote')}
        >
          <span className="font-serif font-bold px-1">"</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('bulletList') ? 'text-accent bg-accent/10' : 'text-fg-muted'}`}
          title={t('editor.bulletList')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>
    </div>
  )
}
