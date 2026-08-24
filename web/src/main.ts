import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { merchantSession } from './auth/session'
import { router } from './router'
import { installMerchantErrorReporter } from './logging/reporter'

merchantSession.setUnauthorizedHandler(async () => {
  if (router.currentRoute.value.name !== 'login') {
    await router.replace({ name: 'login' })
  }
})

installMerchantErrorReporter()
createApp(App).use(router).mount('#app')
