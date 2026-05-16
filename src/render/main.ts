import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

const app = createApp(App)
app.use(ElementPlus)
app.use(createPinia())
app.use(router)
app.mount('#app')
