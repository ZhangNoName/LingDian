import { createApp } from 'vue'
import { ElLoading } from 'element-plus'
import 'element-plus/es/components/loading/style/css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@theme/colors.css'
import './style.css'
import App from './App.vue'
import { installAdminErrorReporter } from './logging/reporter'
import { router } from './router'
import { useTheme } from './theme/theme'

installAdminErrorReporter()
useTheme()
const app = createApp(App)
app.directive('loading', ElLoading.directive)
app.use(router).mount('#app')
