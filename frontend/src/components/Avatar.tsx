// Color keys → Tailwind bg classes (listed so the picker and avatars agree).
export const AVATAR_COLORS = [
  'rose',
  'orange',
  'amber',
  'emerald',
  'teal',
  'sky',
  'indigo',
  'violet',
  'fuchsia',
  'pink',
] as const

const COLOR_CLASS: Record<string, string> = {
  rose: 'bg-rose-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  teal: 'bg-teal-500',
  sky: 'bg-sky-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  fuchsia: 'bg-fuchsia-500',
  pink: 'bg-pink-500',
}

// Stable fallback color per name (same person always gets the same color).
function colorKeyFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

interface AvatarProps {
  name: string
  /** Chosen color key; falls back to a stable hash of the name. */
  color?: string | null
  /** undefined → no presence dot; true/false → green/gray corner dot */
  online?: boolean
  size?: 'sm' | 'md'
}

export default function Avatar({ name, color, online, size = 'md' }: AvatarProps) {
  const dim = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
  const bg = (color && COLOR_CLASS[color]) || COLOR_CLASS[colorKeyFor(name)]
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`inline-flex items-center justify-center rounded-full font-semibold text-white ${bg} ${dim}`}
      >
        {initial(name)}
      </span>
      {online !== undefined && (
        <span
          title={online ? 'çevrimiçi' : 'çevrimdışı'}
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-950 ${
            online ? 'bg-green-500' : 'bg-slate-400 dark:bg-slate-500'
          }`}
        />
      )}
    </span>
  )
}
