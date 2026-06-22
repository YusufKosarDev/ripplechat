interface SkeletonLoaderProps {
  type: 'channel-list' | 'message-list' | 'thread-list'
  count?: number
}

export default function SkeletonLoader({ type, count = 5 }: SkeletonLoaderProps) {
  const items = Array.from({ length: count })

  if (type === 'channel-list') {
    return (
      <div className="space-y-4 p-4" aria-hidden="true">
        {items.map((_, i) => (
          <div key={i} className="flex items-center space-x-3">
            <div className="shimmer h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="shimmer h-4 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'message-list') {
    return (
      <div className="flex-1 space-y-6 overflow-y-auto p-4" aria-hidden="true">
        {items.map((_, i) => {
          // Alternate alignments for a natural dynamic feeling
          const alignRight = i % 3 === 2
          return (
            <div
              key={i}
              className={`flex items-start gap-3 ${alignRight ? 'flex-row-reverse' : ''}`}
            >
              <div className="shimmer h-10 w-10 shrink-0 rounded-full" />
              <div className={`flex flex-col gap-2 max-w-[70%] ${alignRight ? 'items-end' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className="shimmer h-3 w-24 rounded" />
                  <div className="shimmer h-3 w-12 rounded" />
                </div>
                <div className="shimmer h-16 w-80 rounded-2xl" />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // thread-list
  return (
    <div className="space-y-6 p-4" aria-hidden="true">
      {items.map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="shimmer h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <div className="shimmer h-3 w-20 rounded" />
              <div className="shimmer h-3 w-10 rounded" />
            </div>
            <div className="shimmer h-12 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
