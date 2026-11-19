import { createApp } from 'vue'
import '@theme/colors.css'
import './style.css'
import App from './App.vue'
import { installAdminErrorReporter } from './logging/reporter'
import { router } from './router'
import { useTheme } from './theme/theme'

installAdminErrorReporter()
useTheme()
createApp(App).use(router).mount('#app')
