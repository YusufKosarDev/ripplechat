import { matchingCommands } from '../commands/registry'
import { useT } from '../i18n'
import { focusRing } from './ui/focusRing'

interface CommandHintsProps {
  prefix: string
  onPick: (name: string) => void
}

export default function CommandHints({ prefix, onPick }: CommandHintsProps) {
  const { t } = useT()
  const matches = matchingCommands(prefix)
  if (matches.length === 0) return null

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-border bg-surface-overlay shadow-elevated">
      {matches.map((c) => (
        <button
          key={c.name}
          type="button"
          onClick={() => onPick(c.name)}
          className={`flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-surface-muted ${focusRing}`}
        >
          <span className="font-medium text-accent">/{c.name}</span>
          <span className="truncate text-xs text-fg-muted">{t(c.usage)}</span>
        </button>
      ))}
    </div>
  )
}
