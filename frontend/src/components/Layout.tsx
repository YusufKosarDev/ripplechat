import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-6 py-4 backdrop-blur">
        <span className="text-lg font-semibold tracking-tight">
          Ripple<span className="text-indigo-400">Chat</span>
        </span>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
