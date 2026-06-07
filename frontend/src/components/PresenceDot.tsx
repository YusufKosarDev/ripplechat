interface PresenceDotProps {
  online: boolean
}

export default function PresenceDot({ online }: PresenceDotProps) {
  return (
    <span
      title={online ? 'çevrimiçi' : 'çevrimdışı'}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        online ? 'bg-green-500' : 'bg-slate-600'
      }`}
    />
  )
}
