import { useState } from 'react'
import type { ReactionSummary } from '../api/types'

const PICKER = ['👍', '❤️', '😂', '🔥', '🎉', '👀']

interface MessageReactionsProps {
  reactions: ReactionSummary[]
  currentUsername: string
  onToggle: (emoji: string) => void
}

export default function MessageReactions({ reactions, currentUsername, onToggle }: MessageReactionsProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((r) => {
        const mine = r.users.includes(currentUsername)
        return (
          <button
            key={r.emoji}
            type="button"
            onClick={() => onToggle(r.emoji)}
            title={r.users.join(', ')}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
              mine
                ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200'
                : 'border-slate-300 bg-slate-100 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-slate-500'
            }`}
          >
            <span>{r.emoji}</span>
            <span>{r.count}</span>
          </button>
        )
      })}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="hidden items-center rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-400 transition hover:border-slate-400 hover:text-slate-600 group-hover:inline-flex dark:border-slate-700 dark:text-slate-500 dark:hover:border-slate-500 dark:hover:text-slate-300"
          title="Tepki ekle"
        >
          ＋
        </button>
        {open && (
          <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {PICKER.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggle(emoji)
                  setOpen(false)
                }}
                className="rounded px-1 text-base transition hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
