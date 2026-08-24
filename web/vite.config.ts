import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueInspector from 'vite-plugin-vue-inspector'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function bundleSizeBudget(): Plugin {
  return {
    name: 'merchant-bundle-size-budget',
    generateBundle(_options, bundle) {
      for (const [fileName, output] of Object.entries(bundle)) {
        const size = output.type === 'chunk'
          ? Buffer.byteLength(output.code)
          : typeof output.source === 'string'
            ? Buffer.byteLength(output.source)
            : output.source.byteLength
        const limit = fileName.endsWith('.js')
          ? 330 * 1024
          : fileName.endsWith('.css')
            ? 180 * 1024
            : undefined
        if (limit && size > limit) {
          this.error(`${fileName} is ${size} bytes and exceeds the ${limit}-byte merchant budget`)
        }
      }
    },
  }
}

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
    tailwindcss(),
    bundleSizeBudget(),
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
      '@': path.resolve(__dirname, './src'),
      '@theme': path.resolve(__dirname, '../theme'),
    },
  },
})
