import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

type LocaleCode = 'en' | 'zh'

const LOCALE_KEY = 'sub2api_locale'
const DEFAULT_LOCALE: LocaleCode = 'en'

const localeLoaders: Record<LocaleCode, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('./locales/en'),
  zh: () => import('./locales/zh'),
}

function isLocaleCode(value: string): value is LocaleCode {
  return value === 'en' || value === 'zh'
}

function getDefaultLocale(): LocaleCode {
  const saved = localStorage.getItem(LOCALE_KEY)
  if (saved && isLocaleCode(saved)) {
    return saved
  }
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('zh')) {
    return 'zh'
  }
  return DEFAULT_LOCALE
}

const loadedLocales = new Set<LocaleCode>()

async function loadLocaleMessages(locale: LocaleCode): Promise<void> {
  if (loadedLocales.has(locale)) {
    return
  }
  const mod = await localeLoaders[locale]()
  i18n.addResourceBundle(locale, 'translation', mod.default, true, true)
  loadedLocales.add(locale)
}

export async function initI18n(): Promise<void> {
  const defaultLocale = getDefaultLocale()

  await i18n.use(initReactI18next).init({
    lng: defaultLocale,
    fallbackLng: DEFAULT_LOCALE,
    resources: {},
    interpolation: {
      escapeValue: false,
    },
  })

  await loadLocaleMessages(defaultLocale)
  document.documentElement.setAttribute('lang', defaultLocale)
}

export async function setLocale(locale: string): Promise<void> {
  if (!isLocaleCode(locale)) {
    return
  }
  await loadLocaleMessages(locale)
  await i18n.changeLanguage(locale)
  localStorage.setItem(LOCALE_KEY, locale)
  document.documentElement.setAttribute('lang', locale)
}

export function getLocale(): LocaleCode {
  const current = i18n.language
  return isLocaleCode(current) ? current : DEFAULT_LOCALE
}

export const availableLocales = [
  { code: 'en', name: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'zh', name: '\u4E2D\u6587', flag: '\u{1F1E8}\u{1F1F3}' },
] as const

export default i18n
