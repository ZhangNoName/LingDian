# Miniapp Mobile UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the miniapp home, ordering, login, and bottom-tab experiences to match the approved real-device visual direction without changing existing business flows.

**Architecture:** Keep page orchestration and service calls in the existing page components, while moving the new home banner into a focused presentational component. Reuse the existing token layer and icon package, add source-level regression tests for layout invariants, and introduce explicit menu loading/error/empty state rendering without changing catalog contracts.

**Tech Stack:** Vue 3, uni-app, TypeScript 4.9, SCSS, Node test runner, Vitest, pnpm 11.7.0.

## Global Constraints

- Preserve existing API, route, authentication, cart, and ordering behavior.
- Do not add routes, a new state library, or a UI framework.
- Use the existing red, white, and warm-gold brand palette.
- Use real image files and the existing `@lingdian/icons` package; do not draw visible assets with CSS, inline SVG, emoji, or text glyphs.
- Respect `env(safe-area-inset-bottom)` and the existing `--status-bar-height` ownership in `layout/layout.vue`.
- Keep the user's pre-existing `uniapp/src/manifest.json` change out of all task commits.

---

## File Structure

- Create `uniapp/src/components/home/HomeHero.vue`: renders the fixed-aspect brand image and a stable image-error fallback.
- Create `uniapp/src/static/home-brand-placeholder.jpg`: real raster hero asset sized for the home banner slot.
- Create `uniapp/tests/mobile-ui-polish.test.mjs`: source-level layout regression tests for the approved visual invariants.
- Modify `uniapp/src/pages/home/home.vue`: place the hero first and reserve tab-safe scroll space.
- Modify `uniapp/src/components/home/MemberStrip.vue`: tighten responsive account and metric layout.
- Modify `uniapp/src/components/home/ServiceModeCards.vue`: enlarge icon treatment and improve card rhythm.
- Modify `uniapp/src/components/home/RecommendSection.vue`: refine data and empty states.
- Modify `uniapp/src/components/app/AppTabBar.vue`: enlarge icon and touch targets and normalize selected state.
- Modify `uniapp/src/pages/order/order.vue`: render loading/error/empty menu states and reserve the floating cart area.
- Modify `uniapp/src/components/menu/CategorySidebar.vue`: refine selected category visibility.
- Modify `uniapp/src/components/menu/CartCheckoutBar.vue`: use an inset floating layout above the tab bar.
- Modify `uniapp/src/pages/auth/login.vue`: center the login group while remaining scrollable with the keyboard.
- Modify `theme/miniapp-tokens.scss`, `theme/miniapp-tokens.css`, and `theme/miniapp-tokens.json`: keep shared tab, action-bar, radius, and spacing values synchronized.

### Task 1: Lock Approved Layout Invariants With Tests

**Files:**
- Create: `uniapp/tests/mobile-ui-polish.test.mjs`

**Interfaces:**
- Consumes: existing Vue SFC source files and theme token files.
- Produces: source-level assertions used by all later tasks.

- [ ] **Step 1: Write the failing source-level tests**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relativePath => readFile(path.join(root, relativePath), "utf8");

test("home renders a real hero before member content", async () => {
  const home = await read("src/pages/home/home.vue");
  assert.match(home, /import HomeHero from/);
  assert.ok(home.indexOf("<HomeHero") < home.indexOf("<MemberStrip"));
});

test("bottom navigation uses large icons and safe-area padding", async () => {
  const tabbar = await read("src/components/app/AppTabBar.vue");
  assert.match(tabbar, /--ld-tab-icon-size/);
  assert.match(tabbar, /min-height:\s*var\(--ld-tab-touch-height/);
  assert.match(tabbar, /env\(safe-area-inset-bottom\)/);
});

test("menu separates loading error and empty states", async () => {
  const menu = await read("src/pages/order/order.vue");
  assert.match(menu, /menuState === "loading"/);
  assert.match(menu, /menuState === "error"/);
  assert.match(menu, /menuState === "empty"/);
  assert.match(menu, /retryLoadMenu/);
});

test("login content is centered in a scrollable shell", async () => {
  const login = await read("src/pages/auth/login.vue");
  assert.match(login, /class="login-scroll"/);
  assert.match(login, /class="login-shell"/);
  assert.match(login, /justify-content:\s*center/);
});
```

- [ ] **Step 2: Run the test and confirm the new assertions fail**

Run: `node --test uniapp/tests/mobile-ui-polish.test.mjs`

Expected: FAIL because `HomeHero`, shared tab icon sizing, explicit menu states, and the login shell do not exist yet.

- [ ] **Step 3: Commit only the failing test**

```powershell
git add -- uniapp/tests/mobile-ui-polish.test.mjs
git commit -m "test: define miniapp mobile polish invariants"
```

### Task 2: Add the Real Home Hero Asset and Component

**Files:**
- Create: `uniapp/src/static/home-brand-placeholder.jpg`
- Create: `uniapp/src/components/home/HomeHero.vue`
- Modify: `uniapp/src/pages/home/home.vue`

**Interfaces:**
- Consumes: no business data.
- Produces: `<HomeHero />`, a self-contained banner with a fixed height and internal image-error state.

- [ ] **Step 1: Generate the raster asset for the measured slot**

Use the image generation workflow to create a `1500 × 480` warm, premium fast-casual food banner with burgers and drinks, deep brand red accents, soft studio lighting, open negative space, no logos, and no text. Save the selected result as `uniapp/src/static/home-brand-placeholder.jpg` and inspect the saved file at original resolution.

- [ ] **Step 2: Implement the hero component**

```vue
<template>
  <view class="home-hero" aria-label="零点点餐品牌推荐">
    <image
      v-if="!imageFailed"
      class="hero-image"
      src="/static/home-brand-placeholder.jpg"
      mode="aspectFill"
      @error="imageFailed = true"
    />
    <view v-else class="hero-fallback">
      <image class="brand-logo" src="/static/logo-xsf-red-yellow.png" mode="aspectFit" />
      <text class="fallback-copy">新鲜现做，美味到店</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
const imageFailed = ref(false);
</script>
```

Use `height: 240rpx`, `border-radius: var(--ld-radius-24)`, and `overflow: hidden`. The fallback uses a solid warm-neutral surface, not a CSS illustration.

- [ ] **Step 3: Place the hero first on the home page**

Import `HomeHero` and render it before `MemberStrip`. Change `.page` to a vertically scrollable content stack with a shared `gap` and bottom padding that accounts for the tab bar.

- [ ] **Step 4: Run the focused test**

Run: `node --test --test-name-pattern="home renders" uniapp/tests/mobile-ui-polish.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the hero deliverable**

```powershell
git add -- uniapp/src/static/home-brand-placeholder.jpg uniapp/src/components/home/HomeHero.vue uniapp/src/pages/home/home.vue
git commit -m "feat: add branded miniapp home hero"
```

### Task 3: Refine the Home Content Hierarchy

**Files:**
- Modify: `uniapp/src/components/home/MemberStrip.vue`
- Modify: `uniapp/src/components/home/ServiceModeCards.vue`
- Modify: `uniapp/src/components/home/RecommendSection.vue`

**Interfaces:**
- Consumes: existing `CustomerPresentation`, `HomeServiceMode[]`, and `ProductSummary[]` props.
- Produces: unchanged component events `login`, `select`, and `browse`.

- [ ] **Step 1: Add home component assertions**

Extend `mobile-ui-polish.test.mjs` to assert that the member strip uses a responsive `minmax(0, 1fr)` account column, service icons use a shared `--ld-home-mode-icon-size` token, and the recommendation empty state includes both copy and the existing menu CTA.

- [ ] **Step 2: Confirm the assertions fail**

Run: `node --test --test-name-pattern="home" uniapp/tests/mobile-ui-polish.test.mjs`

Expected: FAIL on member-strip and service-icon sizing.

- [ ] **Step 3: Implement the home refinements**

Use a `minmax(0, 1fr) 116rpx 116rpx` member grid, clamp or ellipsize the account column, set service cards to at least `196rpx`, set icon shells to `72rpx`, and reduce the recommendation empty-state height to approximately `220rpx`. Keep all existing labels, product cards, and click events.

- [ ] **Step 4: Re-run the home tests**

Run: `node --test --test-name-pattern="home" uniapp/tests/mobile-ui-polish.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the home component refinement**

```powershell
git add -- uniapp/tests/mobile-ui-polish.test.mjs uniapp/src/components/home/MemberStrip.vue uniapp/src/components/home/ServiceModeCards.vue uniapp/src/components/home/RecommendSection.vue
git commit -m "style: refine miniapp home hierarchy"
```

### Task 4: Enlarge and Normalize the Bottom Tab Bar

**Files:**
- Modify: `theme/miniapp-tokens.scss`
- Modify: `theme/miniapp-tokens.css`
- Modify: `theme/miniapp-tokens.json`
- Modify: `uniapp/src/components/app/AppTabBar.vue`

**Interfaces:**
- Consumes: existing `AppTabKey` and `tabIcons` exports.
- Produces: unchanged `change(key: AppTabKey)` event and new shared CSS variables `--ld-tab-icon-size` and `--ld-tab-touch-height`.

- [ ] **Step 1: Add failing token and component assertions**

Assert the three token formats all contain tab icon size `42rpx` and touch height `80rpx`, and that `AppTabBar.vue` references both variables.

- [ ] **Step 2: Run the focused test**

Run: `node --test --test-name-pattern="bottom navigation" uniapp/tests/mobile-ui-polish.test.mjs`

Expected: FAIL because the variables do not exist.

- [ ] **Step 3: Implement token and tab changes**

Add synchronized token values for a `42rpx` icon and `80rpx` item touch height. Apply them to `.tab-icon` and `.tab-item`, use an `8rpx` icon-label gap, keep the selected brand-red state, and preserve safe-area padding on `.tabbar`.

- [ ] **Step 4: Run focused and existing layout tests**

Run: `node --test uniapp/tests/mobile-ui-polish.test.mjs uniapp/tests/miniapp-layout.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the shared navigation refinement**

```powershell
git add -- theme/miniapp-tokens.scss theme/miniapp-tokens.css theme/miniapp-tokens.json uniapp/src/components/app/AppTabBar.vue uniapp/tests/mobile-ui-polish.test.mjs
git commit -m "style: enlarge miniapp bottom navigation"
```

### Task 5: Add Clear Menu States and a Safe Floating Cart Bar

**Files:**
- Modify: `uniapp/src/pages/order/order.vue`
- Modify: `uniapp/src/components/menu/CategorySidebar.vue`
- Modify: `uniapp/src/components/menu/CartCheckoutBar.vue`

**Interfaces:**
- Consumes: existing `fetchMenu()`, `MenuViewModel`, `CartSummary`, and `canCheckout()`.
- Produces: local `menuState: Ref<"loading" | "ready" | "empty" | "error">` and `retryLoadMenu(): Promise<void>`; no service contract changes.

- [ ] **Step 1: Extend the failing menu assertions**

Assert the menu page declares the four-state union, provides a retry button with `@tap="retryLoadMenu"`, and the cart bar uses left/right inset values plus a fully rounded container.

- [ ] **Step 2: Run the menu test and confirm failure**

Run: `node --test --test-name-pattern="menu" uniapp/tests/mobile-ui-polish.test.mjs`

Expected: FAIL because the current page only renders a text-only empty state and the cart bar is edge-to-edge.

- [ ] **Step 3: Implement menu state transitions**

Set `menuState` to `loading` before `fetchMenu()`, to `empty` when no renderable sections exist, to `ready` when sections exist, and to `error` in the catch branch. Keep the existing Toast. Add `retryLoadMenu()` that calls `loadMenu()` and expose distinct loading, error, and empty state blocks in the product pane.

- [ ] **Step 4: Refine the menu and cart layout**

Keep the `156rpx` sidebar. Place the cart bar at `left/right: var(--ld-page-padding)`, above the complete tabbar and safe area, with a fully rounded `24rpx` container. Use a three-column grid where the checkout column cannot overflow, and reserve matching page bottom padding.

- [ ] **Step 5: Run focused and existing tests**

Run: `node --test uniapp/tests/mobile-ui-polish.test.mjs uniapp/tests/miniapp-layout.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the menu deliverable**

```powershell
git add -- uniapp/tests/mobile-ui-polish.test.mjs uniapp/src/pages/order/order.vue uniapp/src/components/menu/CategorySidebar.vue uniapp/src/components/menu/CartCheckoutBar.vue
git commit -m "style: improve miniapp ordering states"
```

### Task 6: Center and Polish the Login Experience

**Files:**
- Modify: `uniapp/src/pages/auth/login.vue`

**Interfaces:**
- Consumes: existing auth methods, provider list, return URL, cooldown, loading, and error-message mapping.
- Produces: unchanged authentication behavior and a scrollable `login-scroll > login-shell` layout.

- [ ] **Step 1: Run the existing failing login assertion**

Run: `node --test --test-name-pattern="login content" uniapp/tests/mobile-ui-polish.test.mjs`

Expected: FAIL because the centered shell does not exist.

- [ ] **Step 2: Implement the centered structure**

Wrap all existing login content in:

```vue
<scroll-view class="login-scroll" scroll-y>
  <view class="login-shell">
    <view class="login-content">
      <!-- existing hero, form card, and third-party section -->
    </view>
  </view>
</scroll-view>
```

Use `min-height: 100%`, `display: flex`, `justify-content: center`, responsive top/bottom safe padding, and a constrained `login-content` width. Preserve all existing inputs, events, validation, countdown, provider handling, and return navigation.

- [ ] **Step 3: Refine form states**

Use a soft-red verification button, visible focused field border/background, disabled styling that changes both foreground and background, and spacing that keeps the entire content group slightly above geometric center on tall screens.

- [ ] **Step 4: Run focused tests and type checking**

Run: `node --test --test-name-pattern="login content" uniapp/tests/mobile-ui-polish.test.mjs`

Run: `corepack pnpm --filter @lingdian/uniapp type-check`

Expected: both PASS.

- [ ] **Step 5: Commit the login deliverable**

```powershell
git add -- uniapp/src/pages/auth/login.vue
git commit -m "style: center miniapp login experience"
```

### Task 7: Full Verification and Visual QA

**Files:**
- Create: `design-qa.md`
- Modify only when QA identifies a P0/P1/P2 issue: files from Tasks 2–6.

**Interfaces:**
- Consumes: the three supplied real-device screenshots and the completed H5 build.
- Produces: a passing `design-qa.md` and verified local preview.

- [ ] **Step 1: Run the complete uni-app test suite**

Run: `corepack pnpm --filter @lingdian/uniapp test`

Expected: PASS.

- [ ] **Step 2: Run type checking and the H5 production build**

Run: `corepack pnpm --filter @lingdian/uniapp type-check`

Run: `corepack pnpm --filter @lingdian/uniapp build:h5`

Expected: both PASS.

- [ ] **Step 3: Start the H5 app with the project toolchain**

Run: `corepack pnpm --filter @lingdian/uniapp dev:h5 -- --host 0.0.0.0 --port 4173 --strictPort`

Open the local app in the in-app browser at a portrait viewport matching the supplied screenshots. Keep the preview running for handoff.

- [ ] **Step 4: Capture and compare all target states**

Capture the home empty/recommend state, ordering empty state, and login state at the same viewport. Compare each local capture alongside its corresponding supplied screenshot. Record issues in `design-qa.md` using P0–P3 severity and set `final result: failed` until all P0/P1/P2 issues are fixed.

- [ ] **Step 5: Fix visible high-priority mismatches and repeat comparison**

Correct layout overflow, clipped fixed bars, unsafe spacing, undersized icons, incorrect vertical centering, and image crop issues. Rebuild or refresh, recapture, and repeat until `design-qa.md` contains `final result: passed`.

- [ ] **Step 6: Run repository hygiene checks**

Run: `git diff --check`

Run: `git status --short`

Confirm `uniapp/src/manifest.json` remains an unrelated pre-existing modification and is not staged.

- [ ] **Step 7: Commit QA fixes and report**

```powershell
git add -- design-qa.md uniapp/src/components/home/HomeHero.vue uniapp/src/components/home/MemberStrip.vue uniapp/src/components/home/ServiceModeCards.vue uniapp/src/components/home/RecommendSection.vue uniapp/src/components/app/AppTabBar.vue uniapp/src/components/menu/CategorySidebar.vue uniapp/src/components/menu/CartCheckoutBar.vue uniapp/src/pages/home/home.vue uniapp/src/pages/order/order.vue uniapp/src/pages/auth/login.vue uniapp/tests/mobile-ui-polish.test.mjs theme/miniapp-tokens.scss theme/miniapp-tokens.css theme/miniapp-tokens.json
git commit -m "test: verify miniapp mobile UI polish"
```

Do not create this commit if no QA files or fixes changed. Never stage the pre-existing manifest change.
