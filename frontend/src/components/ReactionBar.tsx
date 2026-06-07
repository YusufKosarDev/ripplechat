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
          className="rounded-md px-2 py-1 text-lg leading-none transition hover:scale-125 hover:bg-slate-800"
          title="Reaksiyon gönder"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
