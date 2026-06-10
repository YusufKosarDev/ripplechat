import { useAppDispatch, useAppSelector } from '../app/hooks'
import { toggleTheme } from '../features/ui/uiSlice'
import { focusRing } from './ui/focusRing'

export default function ThemeToggle() {
  const dispatch = useAppDispatch()
  const theme = useAppSelector((state) => state.ui.theme)
  return (
    <button
      onClick={() => dispatch(toggleTheme())}
      title={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
      className={`rounded-lg p-1 text-base leading-none text-fg-muted transition hover:text-fg ${focusRing}`}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
