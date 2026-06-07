import type { ReactNode } from 'react'

interface AuthShellProps {
  title: string
  children: ReactNode
}

export default function AuthShell({ title, children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.18),transparent)]" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 text-center">
          <span className="text-2xl font-semibold tracking-tight">
            Ripple<span className="text-indigo-400">Chat</span>
          </span>
          <h1 className="mt-4 text-lg font-medium text-slate-200">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
