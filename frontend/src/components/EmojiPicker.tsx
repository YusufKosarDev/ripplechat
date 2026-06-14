import { useState } from 'react'
import { EMOJI_GROUPS } from '../emoji'
import { focusRing } from './ui/focusRing'

interface EmojiPickerProps {
  onPick: (emoji: string) => void
  onClose: () => void
}

export default function EmojiPicker({ onPick, onClose }: EmojiPickerProps) {
  const [active, setActive] = useState(0)

  return (
    <div className="absolute bottom-full right-0 z-20 mb-2 w-72 rounded-xl border border-border bg-surface-overlay p-2 shadow-elevated">
      <div className="flex items-center gap-0.5 border-b border-border pb-1">
        {EMOJI_GROUPS.map((group, i) => (
          <button
            key={group.label}
            type="button"
            onClick={() => setActive(i)}
            title={group.label}
            className={`rounded px-1.5 py-0.5 text-base transition ${active === i ? 'bg-surface-muted' : ''} ${focusRing}`}
          >
            {group.emojis[0]}
          </button>
        ))}
        <button type="button" onClick={onClose} className={`ml-auto rounded text-fg-faint hover:text-fg ${focusRing}`}>
          ✕
        </button>
      </div>
      <div className="mt-1 grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto">
        {EMOJI_GROUPS[active].emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            className={`rounded p-1 text-lg transition hover:bg-surface-muted ${focusRing}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
