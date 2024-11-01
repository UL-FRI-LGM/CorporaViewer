import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import de from '@/locales/de.json'
import sl from '@/locales/sl.json'
import hr from '@/locales/hr.json'
import sr from '@/locales/sr.json'


const i18n = createI18n({
    locale: 'sl',
    fallbackLocale: 'de',
    messages: {
        en,
        de,
        sl,
        hr,
        sr
    },
    globalInjection: true
})

export default i18n