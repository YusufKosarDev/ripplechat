import { useAppDispatch, useAppSelector } from '../app/hooks'
import { toggleTheme } from '../features/ui/uiSlice'
import { focusRing } from './ui/focusRing'
import { useT } from '../i18n'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const { t } = useT()
  const dispatch = useAppDispatch()
  const theme = useAppSelector((state) => state.ui.theme)
  return (
    <button
      onClick={() => dispatch(toggleTheme())}
      title={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      className={`rounded-lg p-1 text-base leading-none text-fg-muted transition hover:text-fg ${focusRing}`}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  )
}
