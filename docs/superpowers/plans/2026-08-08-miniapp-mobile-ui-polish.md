# Miniapp Mobile UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the miniapp home, ordering, login, and bottom-tab experiences to match the approved real-device direction without changing existing business flows.

**Architecture:** Keep service calls and page orchestration in the existing pages, isolate the new home image in a focused `HomeHero` component, and extract menu view-state derivation into a pure helper. Test behavior with Vitest and validate visual requirements from the running H5 app with measured DOM geometry, interaction checks, console inspection, and screenshot comparison.

**Tech Stack:** Vue 3, uni-app, TypeScript 4.9, SCSS, Vitest, pnpm 11.7.0, in-app browser automation.

## Global Constraints

- Preserve existing API, route, authentication, cart, and ordering behavior.
- Do not add routes, a state library, a UI framework, or a new icon package.
- Use the existing red, white, and warm-gold brand palette.
- Use real image files and `@lingdian/icons`; do not draw visible assets with CSS, inline SVG, emoji, or text glyphs.
- Respect `env(safe-area-inset-bottom)` and the existing `--status-bar-height` ownership in `layout/layout.vue`.
- Treat visual-only SFC markup and CSS as browser-verified presentation work; do not add source-string tests that merely grep implementation text.
- Keep the user's pre-existing `uniapp/src/manifest.json` change out of all commits.

---

### Task 1: Add Test-Driven Menu View-State Logic

**Files:**
- Create: `uniapp/src/services/menu-view-state.ts`
- Create: `uniapp/src/services/menu-view-state.spec.ts`

**Interfaces:**
- Produces: `type MenuViewState = "loading" | "ready" | "empty" | "error"`.
- Produces: `resolveMenuViewState(input: { loading: boolean; failed: boolean; sectionCount: number }): MenuViewState`.

- [ ] Write a failing Vitest test covering loading precedence, failure, zero sections, and ready content.
- [ ] Run `corepack pnpm --filter @lingdian/uniapp test -- menu-view-state.spec.ts` and confirm failure is caused by the missing helper.
- [ ] Implement the pure helper with precedence `loading -> error -> empty -> ready`.
- [ ] Re-run the focused test and the complete uni-app Vitest suite.
- [ ] Commit the helper and test with `test: add menu view-state rules`.

### Task 2: Generate and Add the Home Hero

**Files:**
- Create: `uniapp/src/static/home-brand-hero.jpg`
- Create: `uniapp/src/components/home/HomeHero.vue`
- Modify: `uniapp/src/pages/home/home.vue`

**Interfaces:**
- Produces: `<HomeHero />`, with no business-data props and an internal image-error state.

- [ ] Generate a real `1536 × 1024` landscape food image with burgers and drinks, premium warm studio lighting, deep-red accents, no logo, and no text. Inspect the image and crop it for the `240rpx` banner slot without stretching.
- [ ] Implement `HomeHero.vue` with `<image mode="aspectFill">`, a stable `240rpx` height, `24rpx` radius, and a fallback that uses the existing logo image on a solid warm-neutral surface.
- [ ] Import and render `HomeHero` before `MemberStrip` in `home.vue`.
- [ ] Make the home content vertically scrollable and reserve tab-safe bottom space.
- [ ] Run uni-app type checking and commit with `feat: add branded miniapp home hero`.

### Task 3: Refine the Home Content Hierarchy

**Files:**
- Modify: `uniapp/src/components/home/MemberStrip.vue`
- Modify: `uniapp/src/components/home/ServiceModeCards.vue`
- Modify: `uniapp/src/components/home/RecommendSection.vue`

**Interfaces:**
- Preserve all existing props and emitted events.

- [ ] Change the member layout to `minmax(0, 1fr) 116rpx 116rpx`, clamp the account text, and prevent the login control from colliding with metrics.
- [ ] Raise service-card minimum height to about `196rpx`, icon shell to `72rpx`, and strengthen title/subtitle rhythm without moving the main actions below the first useful viewport.
- [ ] Reduce recommendation empty-state dead space while retaining its description and `去菜单看看` CTA.
- [ ] Run uni-app type checking and compare the existing layout test against its known 5-failure source-string baseline; this task must add no new failure.
- [ ] Commit with `style: refine miniapp home hierarchy`.

### Task 4: Replace Target-Screen Glyphs and Enlarge the Bottom Tab Bar

**Files:**
- Modify: `packages/icons/src/miniapp.ts`
- Modify: `theme/miniapp-tokens.scss`
- Modify: `theme/miniapp-tokens.css`
- Modify: `theme/miniapp-tokens.json`
- Modify: `uniapp/src/components/app/AppTabBar.vue`
- Modify: miniapp icon consumers that currently interpolate icon exports as Unicode text, including target-screen home, menu, tab, navigation, quantity, checkout, order, profile, and user components.
- Modify: `uniapp/tests/miniapp-layout.test.mjs` only to remove assertions made stale by real component rendering and the existing `onLoad, onShow` import.

**Interfaces:**
- Preserve `change(key: AppTabKey)` and the four existing routes.
- Add synchronized token values for `42rpx` icon size and `80rpx` item touch height.

- [ ] Convert the Unicode icon exports to the existing `lucide-vue-next` components and render them as actual Vue components rather than interpolated objects or text glyphs.
- [ ] Apply `42rpx` visual icon size, at least `80rpx` touch height, `8rpx` icon-label gap, selected brand red, and neutral inactive gray.
- [ ] Keep safe-area bottom padding and avoid drawing a system Home Indicator.
- [ ] Run type checking, H5 build, layout tests with zero failures, and diff check.
- [ ] Commit with `style: enlarge miniapp navigation icons`.

### Task 5: Integrate Menu States and a Safe Floating Cart Bar

**Files:**
- Modify: `uniapp/src/pages/order/order.vue`
- Modify: `uniapp/src/components/menu/CategorySidebar.vue`
- Modify: `uniapp/src/components/menu/CartCheckoutBar.vue`

**Interfaces:**
- Consumes: `resolveMenuViewState` from Task 1.
- Produces: local `loading`, `failed`, `menuState`, and `retryLoadMenu()` state without changing catalog contracts.

- [ ] Set loading before `fetchMenu()`, clear failure on retry, and derive `menuState` from loading/failure/renderable section count.
- [ ] Render distinct loading, error with retry, empty, and ready content in the right pane; keep the existing Toast on request failure.
- [ ] Keep the sidebar near `156rpx`, improve the active indicator, and ensure its scroll area fills the available content height.
- [ ] Place the cart at left/right page padding, fully rounded, above the complete tab bar and safe area; ensure amount, discount, and button never clip.
- [ ] Run the focused view-state test, the complete uni-app suite, and type checking.
- [ ] Commit with `style: improve miniapp ordering states`.

### Task 6: Center and Polish the Login Experience

**Files:**
- Modify: `uniapp/src/pages/auth/login.vue`

**Interfaces:**
- Preserve all authentication methods, provider handling, countdown, error mapping, and return navigation.

- [ ] Wrap the content in a vertical `scroll-view` with a flex shell that centers the content group slightly above geometric center.
- [ ] Reserve top system/capsule space and bottom keyboard/Home Indicator space.
- [ ] Use a constrained content width, soft-red verification button, visible input focus, and distinct disabled foreground/background.
- [ ] Confirm small-height viewports can scroll when the keyboard reduces available space.
- [ ] Run type checking and auth tests.
- [ ] Commit with `style: center miniapp login experience`.

### Task 7: Full Build, Interaction, and Visual QA

**Files:**
- Create: `design-qa.md`
- Modify only if a browser check finds a real issue: files from Tasks 2–6.

**Evidence required:**
- Supplied source screenshots for home, ordering, and login.
- Browser-rendered screenshots at matching portrait dimensions.
- Measured tab icon/touch sizes, fixed-bar positions, page scroll widths, and login content geometry.
- Primary interaction results and browser console inspection.

- [ ] Run `corepack pnpm --filter @lingdian/uniapp test`.
- [ ] Run `corepack pnpm --filter @lingdian/uniapp type-check`.
- [ ] Run `corepack pnpm --filter @lingdian/uniapp build:h5`.
- [ ] Start H5 with the project runtime and open it in the in-app browser.
- [ ] Click all four bottom tabs; test home service cards, menu retry/empty behavior, cart disabled state, login input/send/submit validation, and return navigation that is locally reachable.
- [ ] Check the browser console and verify no horizontal overflow, clipped persistent control, unsafe fixed-bar overlap, or abnormal text wrapping.
- [ ] Capture home, ordering, and login at the same portrait viewport as the supplied screenshots; create combined source/implementation comparison images before judging.
- [ ] Record fonts, spacing, colors, image quality, copy, focused-region checks, iteration history, and `final result: passed|blocked` in `design-qa.md`.
- [ ] Fix every P0/P1/P2 finding, recapture, and compare again until the report says `final result: passed`.
- [ ] Run `git diff --check` and verify the original worktree's `uniapp/src/manifest.json` remains untouched.
- [ ] Commit QA evidence and fixes with `test: verify miniapp mobile UI polish` when files changed.
