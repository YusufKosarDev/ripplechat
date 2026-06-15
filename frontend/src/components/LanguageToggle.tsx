import { useT } from '../i18n'
import { focusRing } from './ui/focusRing'

export default function LanguageToggle() {
  const { lang, setLang, t } = useT()
  const next = lang === 'tr' ? 'en' : 'tr'
  return (
    <button
      onClick={() => setLang(next)}
      title={t('lang.switch')}
      aria-label={t('lang.switch')}
      className={`rounded-lg px-2 py-1 text-xs font-semibold uppercase leading-none text-fg-muted transition hover:text-fg ${focusRing}`}
    >
      {next}
    </button>
  )
}
