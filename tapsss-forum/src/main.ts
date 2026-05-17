import { setAssetBase, setForumApi, setResolveAsset } from '@tapsss/forum-shared'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import * as api from './api'
import App from './App.vue'
import router from './router'
import { proxyImageUrl } from './utils/imageProxy'

setForumApi(api)
setResolveAsset(url => Promise.resolve(proxyImageUrl(url)))
setAssetBase('')

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
