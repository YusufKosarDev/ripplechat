// UI string catalog. Turkish is the source/default language; English mirrors it.
// Keys are dotted by surface. Use {var} placeholders with t(key, { var }).

export type Lang = 'tr' | 'en'

export const translations: Record<Lang, Record<string, string>> = {
  tr: {
    'lang.switch': 'Dili değiştir',

    'landing.badge': '🌊 Gerçek zamanlı sohbet platformu',
    'landing.tagline':
      'Kanallar, thread’ler, reaksiyonlar ve anketler — Slack/Discord tarzı, topluluk odaklı bir sohbet deneyimi. Hepsi canlı, hepsi tek yerde.',
    'landing.demo': '🚀 Demo’yu Dene',
    'landing.demoLoading': 'Giriş yapılıyor…',
    'landing.login': 'Giriş Yap',
    'landing.register': 'Kayıt Ol',
    'landing.demoError': 'Demo girişi şu an yapılamadı, lütfen tekrar dene.',
    'landing.demoHint': 'Demo’yu Dene: hazır bir hesapla tek tıkla, kayıt gerekmez.',

    'feat.realtime.title': 'Gerçek zamanlı',
    'feat.realtime.desc': 'Mesajlar, “yazıyor” göstergesi ve çevrimiçi durum anında akar.',
    'feat.reactions.title': 'Reaksiyonlar',
    'feat.reactions.desc': 'Kalıcı emoji tepkileri ve ekranda uçan canlı reaksiyonlar.',
    'feat.polls.title': 'Anketler',
    'feat.polls.desc': 'Kanal içinde /poll ile saniyeler içinde oylama başlatın.',
    'feat.threads.title': 'Thread’ler',
    'feat.threads.desc': 'Yanıt zincirleriyle tartışmalar ana akışı dağıtmaz.',
    'feat.code.title': 'Kod paylaşımı',
    'feat.code.desc': 'Markdown ve sözdizimi vurgulu kod blokları desteklenir.',
    'feat.theme.title': 'Açık / koyu tema',
    'feat.theme.desc': 'Responsive arayüz, iki temada da şık ve okunaklı.',

    'auth.usernameOrEmail': 'Kullanıcı adı veya e-posta',
    'auth.username': 'Kullanıcı adı',
    'auth.email': 'E-posta',
    'auth.displayName': 'Görünen ad (opsiyonel)',
    'auth.password': 'Şifre',

    'auth.login.title': 'Giriş yap',
    'auth.login.required': 'Kullanıcı adı/e-posta ve şifre zorunludur.',
    'auth.login.submit': 'Giriş yap',
    'auth.login.submitting': 'Giriş yapılıyor...',
    'auth.login.noAccount': 'Hesabın yok mu?',
    'auth.login.registerLink': 'Kayıt ol',

    'auth.register.title': 'Hesap oluştur',
    'auth.register.passwordPlaceholder': 'en az 8 karakter',
    'auth.register.required': 'Kullanıcı adı, e-posta ve şifre zorunludur.',
    'auth.register.shortPassword': 'Şifre en az 8 karakter olmalı.',
    'auth.register.strength.label': 'Şifre gücü',
    'auth.register.strength.weak': 'Zayıf',
    'auth.register.strength.medium': 'Orta',
    'auth.register.strength.strong': 'Güçlü',
    'auth.register.submit': 'Kayıt ol',
    'auth.register.submitting': 'Oluşturuluyor...',
    'auth.register.haveAccount': 'Zaten hesabın var mı?',
    'auth.register.loginLink': 'Giriş yap',

    'error.title': 'Bir şeyler ters gitti',
    'error.body': 'Beklenmeyen bir hata oluştu. Sayfayı yenilemeyi deneyebilirsin.',
    'error.retry': 'Yeniden dene',

    'toast.dismiss': 'Bildirimi kapat',
    'toast.forward.success': 'Mesaj iletildi',
    'toast.forward.error': 'Mesaj iletilemedi',
  },
  en: {
    'lang.switch': 'Switch language',

    'landing.badge': '🌊 Real-time chat platform',
    'landing.tagline':
      'Channels, threads, reactions and polls — a Slack/Discord-style, community-focused chat experience. All live, all in one place.',
    'landing.demo': '🚀 Try the demo',
    'landing.demoLoading': 'Signing in…',
    'landing.login': 'Log in',
    'landing.register': 'Sign up',
    'landing.demoError': 'Demo sign-in is unavailable right now, please try again.',
    'landing.demoHint': 'Try the demo: one click with a ready account, no sign-up needed.',

    'feat.realtime.title': 'Real-time',
    'feat.realtime.desc': 'Messages, the “typing” indicator and presence update instantly.',
    'feat.reactions.title': 'Reactions',
    'feat.reactions.desc': 'Persistent emoji reactions plus live reactions flying across the screen.',
    'feat.polls.title': 'Polls',
    'feat.polls.desc': 'Start a vote in seconds with /poll right inside a channel.',
    'feat.threads.title': 'Threads',
    'feat.threads.desc': 'Reply chains keep discussions from cluttering the main feed.',
    'feat.code.title': 'Code sharing',
    'feat.code.desc': 'Markdown and syntax-highlighted code blocks are supported.',
    'feat.theme.title': 'Light / dark theme',
    'feat.theme.desc': 'A responsive UI that looks sharp and readable in both themes.',

    'auth.usernameOrEmail': 'Username or email',
    'auth.username': 'Username',
    'auth.email': 'Email',
    'auth.displayName': 'Display name (optional)',
    'auth.password': 'Password',

    'auth.login.title': 'Log in',
    'auth.login.required': 'Username/email and password are required.',
    'auth.login.submit': 'Log in',
    'auth.login.submitting': 'Signing in...',
    'auth.login.noAccount': "Don't have an account?",
    'auth.login.registerLink': 'Sign up',

    'auth.register.title': 'Create account',
    'auth.register.passwordPlaceholder': 'at least 8 characters',
    'auth.register.required': 'Username, email and password are required.',
    'auth.register.shortPassword': 'Password must be at least 8 characters.',
    'auth.register.strength.label': 'Password strength',
    'auth.register.strength.weak': 'Weak',
    'auth.register.strength.medium': 'Medium',
    'auth.register.strength.strong': 'Strong',
    'auth.register.submit': 'Sign up',
    'auth.register.submitting': 'Creating...',
    'auth.register.haveAccount': 'Already have an account?',
    'auth.register.loginLink': 'Log in',

    'error.title': 'Something went wrong',
    'error.body': 'An unexpected error occurred. Try reloading the page.',
    'error.retry': 'Try again',

    'toast.dismiss': 'Dismiss notification',
    'toast.forward.success': 'Message forwarded',
    'toast.forward.error': 'Could not forward the message',
  },
}
