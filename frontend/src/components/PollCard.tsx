import type { Poll } from '../api/types'
import { focusRing } from './ui/focusRing'

interface PollCardProps {
  poll: Poll
  myVote?: string
  onVote: (optionId: string) => void
}

export default function PollCard({ poll, myVote, onVote }: PollCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
      <div className="mb-1 text-xs text-fg-muted">📊 Anket · {poll.createdBy}</div>
      <div className="mb-3 font-medium text-fg">{poll.question}</div>
      <div className="space-y-2">
        {poll.options.map((opt) => {
          const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0
          const mine = myVote === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onVote(opt.id)}
              className={`${focusRing} relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition ${
                mine
                  ? 'border-indigo-500'
                  : 'border-control hover:border-control-hover'
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-indigo-500/20 transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <span className="text-fg">
                  {mine ? '✓ ' : ''}
                  {opt.text}
                </span>
                <span className="shrink-0 text-xs text-fg-muted">
                  {opt.votes} · %{pct}
                </span>
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-2 text-xs text-fg-muted">Toplam {poll.totalVotes} oy</div>
    </div>
  )
}
