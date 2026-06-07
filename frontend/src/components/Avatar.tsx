const COLORS = [
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
]

// Stable color per name (same person always gets the same color).
function colorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

interface AvatarProps {
  name: string
  /** undefined → no presence dot; true/false → green/gray corner dot */
  online?: boolean
  size?: 'sm' | 'md'
}

export default function Avatar({ name, online, size = 'md' }: AvatarProps) {
  const dim = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`inline-flex items-center justify-center rounded-full font-semibold text-white ${colorFor(name)} ${dim}`}
      >
        {initial(name)}
      </span>
      {online !== undefined && (
        <span
          title={online ? 'çevrimiçi' : 'çevrimdışı'}
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 ${
            online ? 'bg-green-500' : 'bg-slate-500'
          }`}
        />
      )}
    </span>
  )
}
