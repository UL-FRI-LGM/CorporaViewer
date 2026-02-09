import {createI18n} from 'vue-i18n'
import en from '@/locales/en.json'
import sl from '@/locales/sl.json'

const i18n = createI18n({
    legacy: true,
    locale: 'sl',
    fallbackLocale: 'en',
    messages: {
        en,
        sl,
    },
    globalInjection: true
})

export default i18n

