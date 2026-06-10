import { useAppDispatch, useAppSelector } from '../app/hooks'
import { toggleTheme } from '../features/ui/uiSlice'

export default function ThemeToggle() {
  const dispatch = useAppDispatch()
  const theme = useAppSelector((state) => state.ui.theme)
  return (
    <button
      onClick={() => dispatch(toggleTheme())}
      title={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
      className="rounded-lg p-1 text-base leading-none text-fg-muted transition hover:text-fg"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
