# 全局顶部安全边界 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有 uni-app 页面通过 Layout 统一避开微信状态栏，且顶部安全区只计算一次。

**Architecture:** Layout 的 `.content` 负责 `safe-area-inset-top`，并通过 `showTabBar` 同时支持带 TabBar 与普通详情页面。AppNavBar 移除自身顶部安全区；三个未接入 Layout 的页面包裹在无 TabBar Layout 中。

**Tech Stack:** Vue 3、uni-app、TypeScript、WXSS、Node.js `node:test`。

## Global Constraints

- 不修改页面路由、数据请求、订单或购物车逻辑。
- 顶部状态栏安全区只在 `uniapp/src/layout/layout.vue` 中出现一次。
- 所有页面必须通过 Layout 渲染；固定底部操作区保留底部安全区处理。

---

### Task 1: 统一 Layout 与导航安全区职责

**Files:**
- Modify: `uniapp/src/layout/layout.vue`
- Modify: `uniapp/src/components/app/AppNavBar.vue`
- Modify: `uniapp/tests/miniapp-layout.test.mjs`

**Interfaces:**
- Consumes: `AppTabKey` 和现有 `AppTabBar`。
- Produces: `Layout` props `{ active?: AppTabKey; showTabBar?: boolean }`，默认 `showTabBar: true`。

- [ ] **Step 1: 写出失败的全局安全区契约测试**

在 `miniapp-layout.test.mjs` 断言 Layout 使用 `padding-top: env(safe-area-inset-top)`、条件渲染 `<AppTabBar v-if="showTabBar"`，并断言 AppNavBar 不包含 `safe-area-inset-top`。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/miniapp-layout.test.mjs`

Expected: 新增安全区契约失败，因为 Layout 尚未提供 `showTabBar` 且 AppNavBar 仍处理顶部安全区。

- [ ] **Step 3: 实现唯一的顶部安全区所有者**

在 Layout 中使用：

```vue
<AppTabBar v-if="showTabBar" :active="active" @change="handleTabChange" />
```

```ts
withDefaults(defineProps<{ active?: AppTabKey; showTabBar?: boolean }>(), {
  active: "home",
  showTabBar: true,
});
```

```css
.content { flex: 1; min-height: 0; overflow-y: auto; padding-top: env(safe-area-inset-top); }
.nav { padding: 12rpx var(--ld-page-padding, 24rpx); }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/miniapp-layout.test.mjs`

Expected: 所有测试通过。

### Task 2: 将独立页面接入无 TabBar Layout

**Files:**
- Modify: `uniapp/src/pages/spec/spec.vue`
- Modify: `uniapp/src/pages/checkout/checkout.vue`
- Modify: `uniapp/src/pages/order-detail/order-detail.vue`
- Modify: `uniapp/src/pages/home/home.vue`
- Modify: `uniapp/tests/miniapp-layout.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `<Layout :show-tab-bar="false">`。
- Produces: 所有七个页面均从 Layout 获取顶部状态栏边界。

- [ ] **Step 1: 写出失败的页面接入测试**

断言规格、结算、订单详情分别包含 `<Layout :show-tab-bar="false">`，首页不包含 `safe-area-inset-top`。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/miniapp-layout.test.mjs`

Expected: 新增页面接入断言失败。

- [ ] **Step 3: 最小化页面模板改造**

将三个独立页面根节点包裹在：

```vue
<Layout :show-tab-bar="false">
  <view class="page">...</view>
</Layout>
```

引入 `@/layout/layout.vue`，保留原有 AppNavBar、固定操作栏、脚本和样式。首页删除 `padding-top: calc(env(safe-area-inset-top) + 16rpx)`。

- [ ] **Step 4: 运行全量验证**

Run: `node --test tests/miniapp-layout.test.mjs`

Expected: 所有测试通过。

Run: `corepack pnpm --filter @lingdian/uniapp type-check`

Expected: 成功完成。

Run: `corepack pnpm --filter @lingdian/uniapp build:mp-weixin`

Expected: `DONE  Build complete.`。

- [ ] **Step 5: 提交改动**

```powershell
git add uniapp/src/layout/layout.vue uniapp/src/components/app/AppNavBar.vue uniapp/src/pages/spec/spec.vue uniapp/src/pages/checkout/checkout.vue uniapp/src/pages/order-detail/order-detail.vue uniapp/src/pages/home/home.vue uniapp/tests/miniapp-layout.test.mjs
git commit -m "fix: centralize miniapp top safe area"
```
