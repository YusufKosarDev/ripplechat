const EMOJIS = ['🌊', '❤️', '😂', '🔥', '👍', '🎉']

interface ReactionBarProps {
  onReact: (emoji: string) => void
}

export default function ReactionBar({ onReact }: ReactionBarProps) {
  return (
    <div className="flex gap-1">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          className="rounded-lg px-2 py-1 text-lg leading-none transition hover:scale-125 hover:bg-surface-muted"
          title="Reaksiyon gönder"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
