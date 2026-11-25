import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueInspector from 'vite-plugin-vue-inspector'
import tailwindcss from '@tailwindcss/vite'
import { holdOptionInspector, vueInspectorOptions } from '../packages/console-ui/dev/vue-inspector'

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
export default defineConfig({
  publicDir: path.resolve(__dirname, "../packages/icons/public"),
  plugins: [
    vue(),
    tailwindcss(),
    bundleSizeBudget(),
    vueInspector(vueInspectorOptions),
    holdOptionInspector(),
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
    dedupe: ['vue'],
    alias: {
      '@theme': path.resolve(__dirname, '../theme'),
    },
  },
  test: {
    environment: 'jsdom',
  },
})
