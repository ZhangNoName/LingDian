# High-Priority UI/UX Fixes Implementation Plan

> **For Codex:** Execute each task test-first and keep `packages/observability` untouched.

**Goal:** Remove the highest-impact navigation, authentication, misleading-data, empty-state, and accessibility defects across the merchant, admin, and customer clients.

**Architecture:** Keep each client independent and add small pure helpers for behavior that needs deterministic tests. The merchant app separates desktop collapse state from mobile drawer state. The customer app centralizes protected navigation and safe login return URLs, while presentation helpers derive honest guest/signed-in labels from the existing session data.

**Tech Stack:** Vue 3, Vue Router, uni-app, TypeScript, Vitest, Tailwind CSS, Element Plus, pnpm 11.7.0.

---

## Task 1: Merchant layout state and mobile drawer

**Files:**
- Create: `web/src/layouts/admin-layout/navigation-state.ts`
- Create: `web/src/layouts/admin-layout/navigation-state.spec.ts`
- Modify: `web/src/layouts/admin-layout/index.vue`
- Modify: `web/src/components/layout/app-header/index.vue`
- Modify: `web/src/components/layout/app-sidebar/index.vue`

1. Write failing tests for independent desktop collapse/mobile-open state and drawer dismissal.
2. Run `corepack pnpm --filter @lingdian/web test -- navigation-state.spec.ts` and confirm the failure.
3. Implement the smallest state helper.
4. Add the mobile dialog/backdrop, mobile and desktop header controls, Escape/route dismissal, and `overflow-y-auto` main content.
5. Re-run the focused test and build.

## Task 2: Merchant actions, truthful header, and metadata

**Files:**
- Create: `web/src/config/dashboard-actions.spec.ts`
- Modify: `web/src/config/navigation.ts`
- Modify: `web/src/views/dashboard/index.vue`
- Modify: `web/src/views/stores/index.vue`
- Modify: `web/src/components/layout/app-header/index.vue`
- Modify: `web/src/layouts/admin-layout/index.vue`
- Modify: `web/index.html`

1. Add failing tests for valid quick-action destinations and non-interactive unfinished actions.
2. Replace inert dashboard buttons with router-backed actions.
3. Disable and label store creation/detail controls as under development.
4. Replace fake operating counts/operator labels with current merchant-session information.
5. Set Chinese document language and product title.

## Task 3: Chinese authentication feedback

**Files:**
- Create: `web/src/auth/user-message.ts`
- Create: `web/src/auth/user-message.spec.ts`
- Modify: `web/src/views/auth/login.vue`
- Create: `admin/src/auth/user-message.ts`
- Create: `admin/src/auth/user-message.spec.ts`
- Modify: `admin/src/views/LoginView.vue`

1. Write failing tests for invalid credentials, expired sessions, network failures, and unknown fallbacks.
2. Implement client-specific message normalizers without changing backend diagnostics.
3. Use the normalizers in both login views and expose status via `role="alert"`/live-region semantics.
4. Run the focused admin and web tests.

## Task 4: Customer protected navigation and login return

**Files:**
- Create: `uniapp/src/services/auth-navigation.ts`
- Create: `uniapp/src/services/auth-navigation.spec.ts`
- Modify: `uniapp/src/pages.json`
- Modify: `uniapp/src/layout/layout.vue`
- Modify: `uniapp/src/pages/auth/login.vue`
- Modify: `uniapp/src/pages/order/order.vue`
- Modify: `uniapp/src/pages/checkout/checkout.vue`
- Modify: `uniapp/src/pages/his/his.vue`
- Modify: `uniapp/src/pages/user/user.vue`

1. Write failing tests for protected destinations, encoded login URLs, safe internal return-target validation, and guest redirect behavior.
2. Implement the shared authentication guard.
3. Make home the guest entry page.
4. Protect checkout, orders, and profile at the tab/action and page boundaries.
5. Read the login return target on load and relaunch safely after successful login.

## Task 5: Honest customer identity and empty states

**Files:**
- Create: `uniapp/src/services/customer-presentation.ts`
- Create: `uniapp/src/services/customer-presentation.spec.ts`
- Modify: `uniapp/src/pages/home/home.vue`
- Modify: `uniapp/src/components/home/MemberStrip.vue`
- Modify: `uniapp/src/pages/user/user.vue`
- Modify: `uniapp/src/components/profile/ProfileHeader.vue`
- Modify: `uniapp/src/components/profile/MemberBenefitCard.vue`
- Modify: `uniapp/src/components/profile/ManageGrid.vue`
- Modify: `uniapp/src/components/home/RecommendSection.vue`
- Modify: `uniapp/src/pages/his/his.vue`

1. Write failing tests for guest and signed-in presentations derived only from session fields.
2. Remove fixed mock identity/member asset imports from rendered pages.
3. Add login/register guest actions and honest unavailable-asset text.
4. Add useful menu CTAs for recommendation and order empty states.
5. Connect supported management entries and mark unsupported entries unavailable.

## Task 6: Empty-cart behavior and accessibility

**Files:**
- Create: `uniapp/src/services/checkout-state.ts`
- Create: `uniapp/src/services/checkout-state.spec.ts`
- Modify: `uniapp/src/components/menu/CartCheckoutBar.vue`
- Modify: `uniapp/src/pages/order/order.vue`
- Modify: `uniapp/src/pages/auth/login.vue`
- Modify: `uniapp/src/components/app/AppTabBar.vue`
- Modify: `uniapp/src/components/orders/OrderStatusTabs.vue`
- Modify: `uniapp/src/uni.scss`

1. Write a failing test for empty-cart checkout eligibility.
2. Disable the checkout button and suppress checkout emission when empty.
3. Add explicit input labels and accessible names.
4. Add button roles, focusability, keyboard activation, and selected-state semantics to primary custom controls where supported.
5. Raise inactive navigation text contrast without changing the brand palette.

## Task 7: Verification

1. Run focused tests after every task.
2. Run `corepack pnpm --filter @lingdian/admin test`, `corepack pnpm --filter @lingdian/web test`, and `corepack pnpm --filter @lingdian/uniapp test`.
3. Run `corepack pnpm --filter @lingdian/admin build`, `corepack pnpm --filter @lingdian/web build`, `corepack pnpm --filter @lingdian/uniapp type-check`, and `corepack pnpm --filter @lingdian/uniapp build:h5`.
4. Start affected previews with the project toolchain and verify merchant login/shell and customer guest/login/empty states at desktop and mobile viewports in the in-app browser.
5. Inspect `git diff --check` and `git status --short`, confirming the pre-existing observability changes remain untouched.
