import { setForumApi } from '@tapsss/forum-shared'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import * as api from './api'
import App from './App.vue'
import router from './router'

setForumApi(api)

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
