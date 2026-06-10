import type { ReactNode } from 'react'

interface AuthShellProps {
  title: string
  children: ReactNode
}

export default function AuthShell({ title, children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.18),transparent)]" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-surface-overlay p-8 shadow-lg backdrop-blur">
        <div className="mb-6 text-center">
          <span className="text-2xl font-semibold tracking-tight">
            Ripple<span className="text-indigo-500 dark:text-indigo-400">Chat</span>
          </span>
          <h1 className="mt-4 text-lg font-medium text-fg-secondary">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
