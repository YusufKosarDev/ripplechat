import { matchingCommands } from '../commands/registry'

interface CommandHintsProps {
  prefix: string
  onPick: (name: string) => void
}

export default function CommandHints({ prefix, onPick }: CommandHintsProps) {
  const matches = matchingCommands(prefix)
  if (matches.length === 0) return null

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      {matches.map((c) => (
        <button
          key={c.name}
          type="button"
          onClick={() => onPick(c.name)}
          className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <span className="font-medium text-indigo-600 dark:text-indigo-300">/{c.name}</span>
          <span className="truncate text-xs text-slate-500">{c.usage}</span>
        </button>
      ))}
    </div>
  )
}
