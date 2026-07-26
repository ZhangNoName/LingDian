import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueInspector from 'vite-plugin-vue-inspector'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueInspector({
      toggleComboKey: 'alt',
      toggleButtonVisibility: 'never',
      disableInspectorOnEditorOpen: true,
      launchEditor: 'code',
      viteDevtools: false,
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@theme': path.resolve(__dirname, '../theme'),
    },
  },
  test: {
    environment: 'jsdom',
  },
})
