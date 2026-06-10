import { matchingCommands } from '../commands/registry'

interface CommandHintsProps {
  prefix: string
  onPick: (name: string) => void
}

export default function CommandHints({ prefix, onPick }: CommandHintsProps) {
  const matches = matchingCommands(prefix)
  if (matches.length === 0) return null

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-border bg-surface-overlay shadow-lg">
      {matches.map((c) => (
        <button
          key={c.name}
          type="button"
          onClick={() => onPick(c.name)}
          className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-surface-muted"
        >
          <span className="font-medium text-accent">/{c.name}</span>
          <span className="truncate text-xs text-fg-muted">{c.usage}</span>
        </button>
      ))}
    </div>
  )
}
