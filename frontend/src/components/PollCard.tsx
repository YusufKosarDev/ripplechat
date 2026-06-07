import type { Poll } from '../api/types'

interface PollCardProps {
  poll: Poll
  myVote?: string
  onVote: (optionId: string) => void
}

export default function PollCard({ poll, myVote, onVote }: PollCardProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="mb-1 text-xs text-slate-500">📊 Anket · {poll.createdBy}</div>
      <div className="mb-3 font-medium text-slate-100">{poll.question}</div>
      <div className="space-y-2">
        {poll.options.map((opt) => {
          const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0
          const mine = myVote === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onVote(opt.id)}
              className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition ${
                mine ? 'border-indigo-500' : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-indigo-500/20 transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <span className="text-slate-200">
                  {mine ? '✓ ' : ''}
                  {opt.text}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {opt.votes} · %{pct}
                </span>
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-2 text-xs text-slate-500">Toplam {poll.totalVotes} oy</div>
    </div>
  )
}
