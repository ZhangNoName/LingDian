# 小程序全页布局优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 uni-app 微信小程序统一移动端布局、图标、图片比例与安全区表现，并消除当前小程序端的运行时及 WXSS 布局问题。

**Architecture:** 在 `theme/miniapp-tokens.*` 中扩展唯一的视觉令牌来源，公共 Layout/Nav/TabBar 负责安全区和滚动容器。页面继续保持现有数据获取与路由职责，页面组件只消费令牌；Lucide 图标在 `@lingdian/icons/miniapp` 集中静态导出。

**Tech Stack:** Vue 3、uni-app、Vite、微信小程序、Lucide Vue Next、TypeScript、SCSS/CSS 变量。

## Global Constraints

- 不修改 API、缓存、订单状态规则、购物车计算和路由参数。
- 不引入新的 UI 或图标依赖；新增图标只来自 `lucide-vue-next`。
- 微信小程序端不得使用 `component :is`；图标必须以静态组件标签渲染。
- 组件 WXSS 只使用 class 选择器及 class 状态选择器，避免标签、ID、属性和 `:deep` 选择器。
- 所有固定底部操作区必须使用 `env(safe-area-inset-bottom)`，内容区必须预留其高度。

---

### Task 1: 建立移动端骨架、图标入口与页面生命周期

**Files:**
- Modify: `theme/miniapp-tokens.scss`
- Modify: `theme/miniapp-tokens.css`
- Modify: `packages/icons/src/miniapp.ts`
- Modify: `uniapp/src/layout/layout.vue`
- Modify: `uniapp/src/components/app/AppNavBar.vue`
- Modify: `uniapp/src/components/app/AppTabBar.vue`
- Modify: `uniapp/src/pages/order/order.vue`

**Interfaces:**
- Consumes: `AppTabKey` 和现有 `@lingdian/icons/miniapp` 导出。
- Produces: `--ld-nav-safe-height`、`--ld-page-bottom-safe`、`--ld-fixed-action-height`；`BackIcon`、`SearchIcon`、`CartIcon` 等静态 Lucide 导出。

- [ ] **Step 1: 记录当前小程序构建基线**

Run: `corepack pnpm --filter @lingdian/uniapp build:mp-weixin`

Expected: 构建成功，但记录当前 WXSS 选择器告警和首页/点单页在开发者工具中的布局问题。

- [ ] **Step 2: 扩展主题令牌并同步 CSS 产物**

在两个令牌文件中添加完全相同的值：

```css
--ld-nav-safe-height: 112rpx;
--ld-page-bottom-safe: calc(24rpx + env(safe-area-inset-bottom));
--ld-fixed-action-height: 128rpx;
--ld-card-border: 1rpx solid #ececec;
--ld-mini-shadow-float: 0 12rpx 32rpx rgba(23, 23, 23, 0.08);
```

- [ ] **Step 3: 将公共导航改为静态 Lucide 图标与安全区布局**

在图标入口导出 `ChevronLeft`、`Search`、`ShoppingBag`、`MapPinned`、`ReceiptText`、`CircleHelp` 所需的别名；`AppNavBar` 使用 `BackIcon` 和 `SearchIcon`，不再用文本字符模拟图标。导航容器使用下列结构，标题避让左右操作区：

```css
.nav { min-height: var(--ld-nav-safe-height); padding: env(safe-area-inset-top) 24rpx 12rpx; }
.nav-left { position: relative; z-index: 1; min-width: 88rpx; }
.title { padding: 0 112rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

- [ ] **Step 4: 统一 Layout 与 TabBar 的内容避让**

让 `Layout` 使用 flex 列布局，`.content` 为唯一可滚动区；`AppTabBar` 高度包含 `env(safe-area-inset-bottom)`，不让页面通过 `100vh - 常量` 计算来产生额外留白。

```css
.layout { display: flex; min-height: 100vh; flex-direction: column; overflow: hidden; }
.content { flex: 1; min-height: 0; overflow-y: auto; }
.tabbar { position: relative; padding-bottom: env(safe-area-inset-bottom); }
```

- [ ] **Step 5: 消除点单页 Vue 生命周期运行时风险**

把 `order.vue` 的初次加载从 `onMounted` 改为 uni-app `onLoad`，保留 `onShow` 的购物车刷新；删除 Vue 的 `onMounted`、`onUnmounted` 导入，改用 `onLoad`、`onUnload`：

```ts
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";

onLoad(loadMenu);
onUnload(() => {
  if (initialMeasureTimer) clearTimeout(initialMeasureTimer);
  if (categoryJumpTimer) clearTimeout(categoryJumpTimer);
});
```

- [ ] **Step 6: 验证公共骨架**

Run: `corepack pnpm --filter @lingdian/uniapp build:mp-weixin`

Expected: 成功完成，`dist/build/mp-weixin` 中不包含 `<component` 或 `:is=`。

### Task 2: 重排首页与我的页面

**Files:**
- Modify: `uniapp/src/pages/home/home.vue`
- Modify: `uniapp/src/components/home/MemberStrip.vue`
- Modify: `uniapp/src/components/home/ServiceModeCards.vue`
- Modify: `uniapp/src/components/home/RecommendSection.vue`
- Modify: `uniapp/src/pages/user/user.vue`
- Modify: `uniapp/src/components/profile/ProfileHeader.vue`
- Modify: `uniapp/src/components/profile/MemberBenefitCard.vue`
- Modify: `uniapp/src/components/profile/ManageGrid.vue`

**Interfaces:**
- Consumes: 现有 `MemberSummary`、`HomeServiceMode`、`ProductSummary`、`ManageEntry` 数据结构。
- Produces: 不改变事件接口的首页商品卡和个人中心入口布局。

- [ ] **Step 1: 让首页只使用页面内距与连续分区**

首页 `.page` 使用 `padding: 16rpx var(--ld-page-padding) var(--ld-page-bottom-safe)`，去掉对 `.recommend` 的 `:deep` 选择器，改为内容容器 `gap` 控制区块间距。

- [ ] **Step 2: 重排首页入口与商品卡片**

服务入口卡固定为 `min-height: 176rpx`，加入静态堂食/外卖 Lucide 图标；推荐商品卡采用 `grid-template-rows: 148rpx auto auto 48rpx`，商品图片使用固定高度并在 `image` 失败时保留背景。加购按钮使用明确 `44rpx` 点击区。

- [ ] **Step 3: 收紧个人中心信息层级**

个人页顶部保留 `AppNavBar` 的安全区，资料、会员权益与管理入口使用统一卡片边框和间距；`ManageGrid` 改用纯 class 分隔元素，移除 `.entry text` 与 `:not(:last-child)` 选择器。

- [ ] **Step 4: 运行首页与个人页构建检查**

Run: `corepack pnpm --filter @lingdian/uniapp build:mp-weixin`

Expected: 成功完成，且构建日志不报告 `RecommendSection.wxss` 或 `MemberStrip.wxss` 的不支持选择器。

### Task 3: 改造点单页与商品详情页的可操作区域

**Files:**
- Modify: `uniapp/src/pages/order/order.vue`
- Modify: `uniapp/src/components/menu/StoreHeader.vue`
- Modify: `uniapp/src/components/menu/CategorySidebar.vue`
- Modify: `uniapp/src/components/menu/MenuProductItem.vue`
- Modify: `uniapp/src/components/menu/CartCheckoutBar.vue`
- Modify: `uniapp/src/pages/spec/spec.vue`
- Modify: `uniapp/src/components/spec/ProductHero.vue`
- Modify: `uniapp/src/components/spec/OptionGroup.vue`
- Modify: `uniapp/src/components/spec/QuantityStepper.vue`
- Modify: `uniapp/src/components/spec/SpecActionBar.vue`

**Interfaces:**
- Consumes: 既有菜单、商品规格、购物车事件和 `scroll-into-view` 逻辑。
- Produces: 固定高度商品图片区、可滚动商品区及不遮挡底部结算区的布局。

- [ ] **Step 1: 为点单页建立三段式可视区域**

`.page` 改为 `min-height: 100%; display: flex; flex-direction: column`，移除 `height: 100vh`；`.menu-layout` 使用 `flex: 1`，底部用 `padding-bottom: calc(var(--ld-fixed-action-height) + var(--ld-page-bottom-safe))` 为购物车操作留位。

- [ ] **Step 2: 统一菜单行与购物车操作**

商品行使用 `grid-template-columns: 176rpx minmax(0, 1fr)`，图片固定 `176rpx × 132rpx`，名称最多两行，价格与规格按钮在右下对齐。购物车栏改为页面底部全宽操作区，保留商品数量、金额和结算事件，使用 `CartIcon` 替代字符图标。

- [ ] **Step 3: 收拢详情页图片、规格与购买栏**

主图固定 `aspect-ratio: 16 / 9`，组合图作为同高小图；规格卡用 class 状态 `.card.active`；数量控制器将加减图标替换成静态 `MinusIcon`/`PlusIcon`。详情内容底部预留 `var(--ld-fixed-action-height)`，操作栏保留两个现有事件。

- [ ] **Step 4: 验证商品文字和操作区稳定性**

Run: `corepack pnpm --filter @lingdian/uniapp type-check`

Expected: TypeScript 无新增错误；商品名、规格名和价格字段仍使用现有类型。

### Task 4: 重排结算页与支付操作区

**Files:**
- Modify: `uniapp/src/pages/checkout/checkout.vue`
- Modify: `uniapp/src/components/checkout/CheckoutStoreCard.vue`
- Modify: `uniapp/src/components/checkout/CheckoutProductCard.vue`
- Modify: `uniapp/src/components/checkout/PayBar.vue`
- Modify: `uniapp/src/components/checkout/AddOnList.vue`

**Interfaces:**
- Consumes: 现有 `CartSummary`、`StoreSummary`、`OrderAmount` 和 `pay` 事件。
- Produces: 底部支付栏不遮挡金额卡、门店与取餐方式可扫读的结算页。

- [ ] **Step 1: 将结算内容改成连续分区**

结算页 `.page` 使用统一背景和 `padding-bottom: calc(var(--ld-fixed-action-height) + var(--ld-page-bottom-safe))`。门店、商品和金额保持为相邻分区，消除负 margin 的优惠条，使用普通 class 边界分隔。

- [ ] **Step 2: 让取餐方式与商品行适配窄屏**

取餐卡使用两个等宽选项与 `min-height: 116rpx`；商品行采用 `104rpx minmax(0, 1fr) auto`，名称和规格文字在窄屏截断但金额列不被挤压。保留堂食和外带静态 Lucide 图标。

- [ ] **Step 3: 固定支付栏并验证可点击面积**

支付栏使用 `.pay-bar { min-height: var(--ld-fixed-action-height); padding-bottom: calc(14rpx + env(safe-area-inset-bottom)); }`，支付按钮最小高度 `84rpx`，金额和按钮始终在第一屏可见。

- [ ] **Step 4: 构建验证结算页**

Run: `corepack pnpm --filter @lingdian/uniapp build:mp-weixin`

Expected: 构建成功，`CheckoutStoreCard` 不再生成动态组件或不支持 WXSS 选择器。

### Task 5: 重排订单列表、详情与状态操作

**Files:**
- Modify: `uniapp/src/pages/his/his.vue`
- Modify: `uniapp/src/components/orders/OrderStatusTabs.vue`
- Modify: `uniapp/src/components/orders/OrderHistoryCard.vue`
- Modify: `uniapp/src/pages/order-detail/order-detail.vue`
- Modify: `uniapp/src/components/orders/OrderDetailGoodsCard.vue`
- Modify: `uniapp/src/components/orders/OrderInfoCard.vue`

**Interfaces:**
- Consumes: `OrderSummary`、`OrderDetail` 和现有 `detail`、`reorder` 事件。
- Produces: 稳定的订单卡三层信息结构和可读的本地时间展示。

- [ ] **Step 1: 格式化订单时间而不改变服务端模型**

在 `OrderHistoryCard.vue` 添加纯函数：

```ts
function formatOrderTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
```

模板展示 `formatOrderTime(order.createdAt)`，原始字符串继续留在数据模型中。

- [ ] **Step 2: 将订单卡收敛为三层**

门店与状态行使用 `minmax(0, 1fr) auto`；商品缩略图最多渲染三张，更多商品显示数量文本；金额与操作行使用纯 class 元素，按钮宽度由内容和最小点击区决定，不以固定卡片列宽压缩门店名。

- [ ] **Step 3: 统一订单详情的状态、金额与底部操作**

详情页状态区采用页面内距，商品与信息区使用统一卡片边界；完成订单的“再来一单”固定到底部安全区，详情内容增加相同高度的底部留白。用 Lucide 静态图标替代详情卡中的文本符号。

- [ ] **Step 4: 运行订单构建检查**

Run: `corepack pnpm --filter @lingdian/uniapp build:mp-weixin`

Expected: 成功完成，订单卡长门店名、空图片和多商品情况下没有重叠或卡片高度跳变。

### Task 6: 全量回归与视觉验收

**Files:**
- Modify: 仅修改前述任务中确认需要调整的样式文件。
- Test: `uniapp/dist/build/mp-weixin`

**Interfaces:**
- Consumes: 前五项完成后的页面与图标入口。
- Produces: 可直接导入微信开发者工具的构建产物。

- [ ] **Step 1: 搜索平台不兼容模式**

Run: `rg -n "<component|:is=|:deep\(|(^|[^.-])[a-z]+\s*\{" uniapp/src`

Expected: 没有动态组件和 `:deep`；若有标签选择器，仅保留全局 `App.vue` 的 `page` 与 `view, text` 基础规则。

- [ ] **Step 2: 运行静态检查和生产构建**

Run: `corepack pnpm --filter @lingdian/uniapp type-check`

Expected: 成功完成。

Run: `corepack pnpm --filter @lingdian/uniapp build:mp-weixin`

Expected: `DONE  Build complete.`，且无 `<component is>`、WXSS 选择器不支持或 `onMounted is not a function` 相关问题。

- [ ] **Step 3: 微信开发者工具手工验收**

导入 `E:\MyProject\LingDian\uniapp\dist\build\mp-weixin`，依次检查首页、点单、规格、结算、订单、订单详情、我的。确认顶部胶囊、底部 TabBar、固定支付/购物车栏不遮挡内容，并使用空图片、长商品名和多个订单验证布局不溢出。

- [ ] **Step 4: 提交每个已验证的任务改动**

每个任务单独提交，仅暂存该任务涉及的文件，例如：

```powershell
git add theme/miniapp-tokens.scss theme/miniapp-tokens.css packages/icons/src/miniapp.ts uniapp/src/layout/layout.vue uniapp/src/components/app/AppNavBar.vue uniapp/src/components/app/AppTabBar.vue uniapp/src/pages/order/order.vue
git commit -m "feat: unify miniapp layout foundation"
```
