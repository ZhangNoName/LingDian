import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@theme/colors.css'
import './style.css'
import App from './App.vue'
import { installAdminErrorReporter } from './logging/reporter'
import { router } from './router'
import { useTheme } from './theme/theme'

installAdminErrorReporter()
useTheme()
createApp(App).use(ElementPlus).use(router).mount('#app')
