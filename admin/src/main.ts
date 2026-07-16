import { createApp } from 'vue'
import '@theme/colors.css'
import './style.css'
import App from './App.vue'
import { installAdminErrorReporter } from './logging/reporter'

installAdminErrorReporter()
createApp(App).mount('#app')
