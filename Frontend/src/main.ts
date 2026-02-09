import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

// bootstrap
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min'

// fontawesome
import '@fortawesome/fontawesome-free/css/all.min.css'

// datepicker
import VueDatePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';

// axios
import axios from 'axios';

// styles
import './style.css'

// multilanguage support
import i18n from './data/i18setup'

const app = createApp(App)
app.use(i18n)
app.component('vue-date-picker', VueDatePicker);
app.config.globalProperties.$axios = axios
app.config.globalProperties.$filters = {
    highlightText(text: string, targetWords: string[]) {
        if (!text) return '';
        if (!targetWords || targetWords.length === 0) return text;

        const words = text.split(' ');
        let result = '';
        words.forEach(word => {
            if (targetWords.includes(word.toLowerCase().replace(/[^a-zA-ZäöüßÄÖÜčšžČŠŽ]/g,""))) {
                result += `<span class="highlight-result">${word}</span> `;
            } else {
                result += `${word} `;
            }
        });

        return result;
    },
};
app.use(store).use(router).mount('#app');
