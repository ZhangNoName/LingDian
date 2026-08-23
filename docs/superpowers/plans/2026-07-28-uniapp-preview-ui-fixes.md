# Uni-app Preview and UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 uni-app 在微信开发者工具中使用可运行的基础库，并使首页与点单页在图片缺失、长文本和异常数据下保持稳定布局。

**Architecture:** 在清单配置层固定微信基础库版本，在 catalog 映射层集中选择本地兜底图片，在两个商品展示组件内处理图片加载失败；文本完整值保留在视图模型中，仅由组件样式限制展示范围。

**Tech Stack:** uni-app、Vue 3、TypeScript、Node.js test、Vitest、微信小程序构建。

## Global Constraints

- 微信基础库固定为 `3.15.2`。
- 不修改或删除后端异常商品数据。
- 不引入新依赖或网络图片服务。
- 分类名与商品名的完整值必须保留，仅限制视觉展示。

---

### Task 1: 微信基础库与布局保护

**Files:**
- Modify: `uniapp/tests/miniapp-layout.test.mjs`
- Modify: `uniapp/src/manifest.json`
- Modify: `uniapp/src/components/menu/CategorySidebar.vue`
- Modify: `uniapp/src/components/menu/MenuProductItem.vue`

**Interfaces:**
- Consumes: uni-app `manifest.json` 微信小程序配置和现有组件样式。
- Produces: 生成工程的 `libVersion: "3.15.2"`，以及分类、商品名称的两行安全展示。

- [ ] **Step 1: Write the failing tests**

在 `miniapp-layout.test.mjs` 中断言 manifest 包含 `"libVersion": "3.15.2"`；分类文本使用独立 `.category-name` 类且包含 `overflow-wrap: anywhere` 与两行限制；商品名包含 `overflow-wrap: anywhere` 与两行限制。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test uniapp/tests/miniapp-layout.test.mjs`
Expected: FAIL，因为 manifest 和样式保护尚未实现。

- [ ] **Step 3: Write minimal implementation**

为微信配置增加 `libVersion`；为分类文本增加 `.category-name`；修正商品名称重复的 `display` 声明并增加连续字符换行规则。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test uniapp/tests/miniapp-layout.test.mjs`
Expected: PASS。

### Task 2: 分类化兜底图片与失败占位

**Files:**
- Create: `uniapp/src/services/product-image.spec.ts`
- Create: `uniapp/src/services/product-image.ts`
- Modify: `uniapp/src/services/catalog.ts`
- Modify: `uniapp/src/components/home/RecommendSection.vue`
- Modify: `uniapp/src/components/menu/MenuProductItem.vue`

**Interfaces:**
- Produces: `resolveProductImage(url: string | null | undefined, categoryName: string): string`。
- Consumes: `ProductRecordContract.image_url` 与分类名称。

- [ ] **Step 1: Write the failing unit test**

覆盖绝对 URL、`/static` URL、相对资源 URL，以及 burger/snack/drink/combo 分类的本地兜底映射。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lingdian/uniapp test -- src/services/product-image.spec.ts`
Expected: FAIL，因为 `resolveProductImage` 尚不存在。

- [ ] **Step 3: Implement the resolver and integrate catalog mapping**

新增纯函数，根据分类关键词返回四张既有本地图片之一；`catalog.ts` 传入 `category.name`，不再使用通用 `resolveAssetUrl` 兜底。

- [ ] **Step 4: Add static failed-image UI**

首页和点单项在 `@error` 后显示餐品符号与“图片待更新”，并为相关样式添加布局测试断言。

- [ ] **Step 5: Run focused tests**

Run: `pnpm --filter @lingdian/uniapp test -- src/services/product-image.spec.ts && node --test uniapp/tests/miniapp-layout.test.mjs`
Expected: PASS。

### Task 3: 全量验证与视觉复验

**Files:**
- Verify only; no additional production files expected.

**Interfaces:**
- Consumes: Tasks 1–2 的全部修改。
- Produces: 可复现的测试、构建和 UI 证据。

- [ ] **Step 1: Run all automated checks**

Run: `pnpm --filter @lingdian/uniapp type-check && pnpm --filter @lingdian/uniapp test && node --test uniapp/tests/miniapp-layout.test.mjs`
Expected: 全部通过。

- [ ] **Step 2: Build both targets**

Run: `pnpm --filter @lingdian/uniapp build:h5 && pnpm --filter @lingdian/uniapp build:mp-weixin`
Expected: 两个构建均退出码 0，生成的小程序 `project.config.json` 使用基础库 3.15.2。

- [ ] **Step 3: Verify mobile UI**

在 390×844 视口打开首页与点单页，确认分类栏不溢出、商品名不破版、失败图片占位清晰，控制台没有应用错误。

- [ ] **Step 4: Verify WeChat simulator**

重新导入或重新打开 `uniapp/dist/dev/mp-weixin`，编译后确认模拟器页面和控制台状态。
