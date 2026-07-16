import { createApp } from 'vue'
import './style.css'
import 'element-plus/dist/index.css'
import App from './App.vue'
import { merchantSession } from './auth/session'
import { router } from './router'

merchantSession.setUnauthorizedHandler(async () => {
  if (router.currentRoute.value.name !== 'login') {
    await router.replace({ name: 'login' })
  }
})

createApp(App).use(router).mount('#app')
