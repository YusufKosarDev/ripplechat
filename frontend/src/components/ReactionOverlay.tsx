import type { CSSProperties } from 'react'

export interface FlyingEmoji {
  id: string
  emoji: string
  left: number // percent across the panel
  drift: number // px horizontal sway
  duration: number // seconds
  size: number // rem
}

interface ReactionOverlayProps {
  items: FlyingEmoji[]
}

export default function ReactionOverlay({ items }: ReactionOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((item) => (
        <span
          key={item.id}
          className="ripple-emoji"
          style={
            {
              left: `${item.left}%`,
              fontSize: `${item.size}rem`,
              animationDuration: `${item.duration}s`,
              '--drift': `${item.drift}px`,
            } as CSSProperties
          }
        >
          {item.emoji}
        </span>
      ))}
    </div>
  )
}
