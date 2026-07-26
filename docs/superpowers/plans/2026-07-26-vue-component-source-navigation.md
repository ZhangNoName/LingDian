# Vue Component Source Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Alt-triggered component inspection in the `admin` and `web` Vite development servers so one left click opens the matching Vue source location in VS Code.

**Architecture:** Register `vite-plugin-vue-inspector` independently in both Vue 3 + Vite 8 applications. Keep the integration entirely in Vite configuration, active only while serving development builds, and lock the intended shortcut/editor behavior with a repository-level Node configuration test.

**Tech Stack:** pnpm 11.7.0 via Corepack, Vue 3.5, Vite 8, TypeScript, Node.js test runner, `vite-plugin-vue-inspector` 7.x

## Global Constraints

- Scope is limited to `admin` and `web`; do not modify `uniapp` because it uses Vite 5.
- Use `vite-plugin-vue-inspector` 7.x and target VS Code with `launchEditor: 'code'`.
- Use `toggleComboKey: 'alt'`, `toggleButtonVisibility: 'never'`, and `disableInspectorOnEditorOpen: true`.
- Set `viteDevtools: false` so the change adds only component source inspection, not the full DevTools panel.
- Use `corepack pnpm` so the repository's declared `pnpm@11.7.0` is selected.
- Preserve unrelated changes under `packages/observability`.

---

### Task 1: Add and verify Vue component source navigation

**Files:**
- Create: `tests/vue-component-source-navigation.test.mjs`
- Modify: `admin/package.json`
- Modify: `admin/vite.config.ts`
- Modify: `web/package.json`
- Modify: `web/vite.config.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: each application's existing Vite plugin array and Vue plugin registration.
- Produces: a development-only inspector configured with the shared options `toggleComboKey`, `toggleButtonVisibility`, `disableInspectorOnEditorOpen`, `launchEditor`, and `viteDevtools`.

- [ ] **Step 1: Write the failing configuration contract test**

Create `tests/vue-component-source-navigation.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test and verify the missing integration fails**

Run:

```powershell
node --test tests/vue-component-source-navigation.test.mjs
```

Expected: both subtests fail with `should register vite-plugin-vue-inspector`, proving that the real Vite configurations do not yet provide the behavior.

- [ ] **Step 3: Add the plugin to both workspace applications**

Run:

```powershell
corepack pnpm --filter @lingdian/admin --filter @lingdian/web add -D vite-plugin-vue-inspector@^7.0.0
```

Expected: `admin/package.json`, `web/package.json`, and `pnpm-lock.yaml` are updated without changing `uniapp/package.json`.

- [ ] **Step 4: Register the inspector in both Vite configurations**

Add this import after the existing Vue plugin import in both `admin/vite.config.ts` and `web/vite.config.ts`:

```ts
import vueInspector from 'vite-plugin-vue-inspector'
```

Add this plugin immediately after `vue()` in each existing `plugins` array, preserving `web`'s Tailwind plugin:

```ts
vueInspector({
  toggleComboKey: 'alt',
  toggleButtonVisibility: 'never',
  disableInspectorOnEditorOpen: true,
  launchEditor: 'code',
  viteDevtools: false,
})
```

- [ ] **Step 5: Run the configuration contract test**

Run:

```powershell
node --test tests/vue-component-source-navigation.test.mjs
```

Expected: 2 tests pass and 0 fail.

- [ ] **Step 6: Verify both production builds**

Run:

```powershell
corepack pnpm --filter @lingdian/admin build
corepack pnpm --filter @lingdian/web build
```

Expected: both commands exit with code 0, proving the inspector configuration type-checks and remains excluded from production serving behavior.

- [ ] **Step 7: Smoke-test both development servers**

Run each command long enough to reach Vite's ready state, then stop it:

```powershell
corepack pnpm --filter @lingdian/admin dev -- --host 127.0.0.1
corepack pnpm --filter @lingdian/web dev -- --host 127.0.0.1
```

Expected: each server prints a local URL and no inspector configuration or module-resolution error.

- [ ] **Step 8: Review and commit only scoped implementation files**

Run:

```powershell
git diff --check -- admin/package.json admin/vite.config.ts web/package.json web/vite.config.ts pnpm-lock.yaml tests/vue-component-source-navigation.test.mjs
git diff -- admin/package.json admin/vite.config.ts web/package.json web/vite.config.ts pnpm-lock.yaml tests/vue-component-source-navigation.test.mjs
```

Confirm `uniapp` and `packages/observability` are absent from the diff, then commit:

```powershell
git add -- admin/package.json admin/vite.config.ts web/package.json web/vite.config.ts pnpm-lock.yaml tests/vue-component-source-navigation.test.mjs
git commit -m "feat: add Vue component source navigation"
```
