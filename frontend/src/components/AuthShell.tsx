import type { ReactNode } from 'react'

interface AuthShellProps {
  title: string
  children: ReactNode
}

export default function AuthShell({ title, children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.18),transparent)]" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mb-6 text-center">
          <span className="text-2xl font-semibold tracking-tight">
            Ripple<span className="text-indigo-500 dark:text-indigo-400">Chat</span>
          </span>
          <h1 className="mt-4 text-lg font-medium text-slate-700 dark:text-slate-200">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
