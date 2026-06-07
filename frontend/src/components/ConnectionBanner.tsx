import { useAppSelector } from '../app/hooks'

// Stays out of the way when connected; shows a thin amber bar while the
// realtime connection is down or re-establishing.
export default function ConnectionBanner() {
  const status = useAppSelector((state) => state.connection.status)

  if (status === 'connected') {
    return null
  }

  return (
    <div className="bg-amber-500/90 px-4 py-1 text-center text-xs font-medium text-slate-950">
      Bağlantı yeniden kuruluyor...
    </div>
  )
}
