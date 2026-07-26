import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const requireFromAdmin = createRequire(new URL('../admin/package.json', import.meta.url))
const { loadConfigFromFile } = await import(pathToFileURL(requireFromAdmin.resolve('vite')).href)

const apps = ['admin', 'web']
const expectedOptions = {
  toggleComboKey: 'alt',
  toggleButtonVisibility: 'never',
  disableInspectorOnEditorOpen: true,
  launchEditor: 'code',
  viteDevtools: false,
}

async function invokeHook(hook, ...args) {
  const handler = typeof hook === 'function' ? hook : hook?.handler
  return handler?.call({}, ...args)
}

for (const app of apps) {
  test(`${app} configures Alt-click Vue source navigation`, async () => {
    const configPath = fileURLToPath(new URL(`../${app}/vite.config.ts`, import.meta.url))
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, configPath)
    assert.ok(loaded, `${app} Vite config should load`)

    const plugins = loaded.config.plugins.flat(Infinity).filter(Boolean)
    const inspector = plugins.find(plugin => plugin.name === 'vite-plugin-vue-inspector')
    assert.ok(inspector, `${app} should register vite-plugin-vue-inspector`)

    await invokeHook(inspector.configResolved, { base: '/' })
    const loadedOptions = await invokeHook(inspector.load, 'virtual:vue-inspector-options')
    const optionSource = typeof loadedOptions === 'string' ? loadedOptions : loadedOptions?.code
    assert.ok(optionSource?.startsWith('export default '), `${app} should expose inspector options`)

    const options = JSON.parse(optionSource.slice('export default '.length).replace(/;\s*$/, ''))
    assert.deepEqual(
      Object.fromEntries(Object.keys(expectedOptions).map(key => [key, options[key]])),
      expectedOptions,
    )
  })
}
