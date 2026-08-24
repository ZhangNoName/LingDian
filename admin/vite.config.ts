import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueInspector from 'vite-plugin-vue-inspector'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function bundleSizeBudget(): Plugin {
  return {
    name: 'admin-bundle-size-budget',
    generateBundle(_options, bundle) {
      for (const [fileName, output] of Object.entries(bundle)) {
        const size = output.type === 'chunk'
          ? Buffer.byteLength(output.code)
          : typeof output.source === 'string'
            ? Buffer.byteLength(output.source)
            : output.source.byteLength
        const limit = fileName.endsWith('.js')
          ? 360 * 1024
          : fileName.endsWith('.css')
            ? 120 * 1024
            : undefined
        if (limit && size > limit) {
          this.error(`${fileName} is ${size} bytes and exceeds the ${limit}-byte admin budget`)
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: mode === 'test' ? false : 'css' })],
      dts: false,
    }),
    bundleSizeBudget(),
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
}))
