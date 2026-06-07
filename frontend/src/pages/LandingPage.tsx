export default function LandingPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-65px)] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.18),transparent)]" />
      <div className="relative z-10 max-w-2xl">
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          Ripple<span className="text-indigo-400">Chat</span>
        </h1>
        <p className="mt-5 text-lg text-slate-400">
          Real-time messaging for communities. Channels, presence, and live
          conversation.
        </p>
        <p className="mt-10 text-sm text-slate-600">
          Frontend skeleton ready — screens coming soon.
        </p>
      </div>
    </div>
  )
}
