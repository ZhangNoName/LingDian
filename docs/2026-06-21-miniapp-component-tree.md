# 零点点餐微信小程序组件拆分与结构树

## 1. 目标

本文档把当前设计稿拆成可开发的页面、业务组件、基础组件和数据结构，为后续 uni-app 实现做准备。

当前设计稿包含 6 个页面：

- 首页
- 点餐 / 菜单列表
- 购物车 / 商品规格
- 订单 / 提交订单
- 订单 / 历史订单
- 订单详情
- 个人中心

现有 uni-app 入口已有：

- `uniapp/src/pages/home/home.vue`
- `uniapp/src/pages/order/order.vue`
- `uniapp/src/pages/his/his.vue`
- `uniapp/src/pages/user/user.vue`

建议后续在此基础上补齐规格页、提交订单页，并重构已有页面内容。

## 2. 总体页面树

```text
MiniApp
├─ AppShell
│  ├─ MiniStatusBar
│  ├─ WechatCapsule
│  └─ AppTabBar
│     ├─ 首页
│     ├─ 点单
│     ├─ 订单
│     └─ 我的
├─ HomePage 首页
├─ MenuPage 点餐 / 菜单列表
├─ ProductSpecPage 购物车 / 商品规格
├─ CheckoutPage 订单 / 提交订单
├─ OrderListPage 订单 / 历史订单
├─ OrderDetailPage 订单详情
└─ ProfilePage 个人中心
```

## 3. 推荐目录结构

```text
uniapp/src
├─ pages
│  ├─ home/home.vue
│  ├─ order/order.vue              # 点餐菜单页，沿用现有入口
│  ├─ spec/spec.vue                # 新增：商品规格页
│  ├─ checkout/checkout.vue        # 新增：提交订单页
│  ├─ his/his.vue                  # 订单列表页，沿用现有入口
│  ├─ order-detail/order-detail.vue # 新增：订单详情页
│  └─ user/user.vue
├─ components
│  ├─ app
│  │  ├─ AppNavBar.vue
│  │  ├─ AppTabBar.vue
│  │  ├─ WechatCapsule.vue
│  │  └─ PriceText.vue
│  ├─ home
│  │  ├─ StoreHero.vue
│  │  ├─ MemberStrip.vue
│  │  ├─ ServiceModeCards.vue
│  │  ├─ QuickEntryGrid.vue
│  │  └─ RecommendSection.vue
│  ├─ menu
│  │  ├─ StoreHeader.vue
│  │  ├─ CategorySidebar.vue
│  │  ├─ MenuProductList.vue
│  │  ├─ MenuProductItem.vue
│  │  └─ CartCheckoutBar.vue
│  ├─ spec
│  │  ├─ ProductHero.vue
│  │  ├─ QuantityStepper.vue
│  │  ├─ OptionGroup.vue
│  │  ├─ OptionCard.vue
│  │  └─ SpecActionBar.vue
│  ├─ checkout
│  │  ├─ CheckoutStoreCard.vue
│  │  ├─ ServiceModeSelector.vue
│  │  ├─ CheckoutProductCard.vue
│  │  ├─ AddOnList.vue
│  │  ├─ CouponStrip.vue
│  │  └─ PayBar.vue
│  ├─ orders
│  │  ├─ OrderStatusTabs.vue
│  │  ├─ OrderHistoryCard.vue
│  │  ├─ OrderDetailGoodsCard.vue
│  │  ├─ OrderInfoCard.vue
│  │  └─ OrderProductThumbs.vue
│  └─ profile
│     ├─ ProfileHeader.vue
│     ├─ MemberBenefitCard.vue
│     ├─ AssetCards.vue
│     └─ ManageGrid.vue
├─ composables
│  ├─ useCart.ts
│  ├─ useMenu.ts
│  ├─ useOrder.ts
│  └─ useMember.ts
├─ services
│  ├─ store.ts
│  ├─ menu.ts
│  ├─ cart.ts
│  ├─ order.ts
│  └─ member.ts
├─ types
│  ├─ store.ts
│  ├─ menu.ts
│  ├─ cart.ts
│  ├─ order.ts
│  └─ member.ts
└─ uni.scss
```

## 4. 页面组件树

### 4.1 首页 HomePage

```text
HomePage
├─ AppNavBar
│  ├─ StoreLocationPill
│  └─ WechatCapsule
├─ StoreHero
│  ├─ PromoText
│  └─ PromoProductImageGroup
├─ MemberStrip
│  ├─ MemberName
│  ├─ PointsSummary
│  └─ CouponSummary
├─ ServiceModeCards
│  ├─ ServiceModeCard(type="dineIn")
│  └─ ServiceModeCard(type="delivery")
├─ QuickEntryGrid
│  ├─ QuickEntry(type="badge")
│  ├─ QuickEntry(type="team")
│  ├─ QuickEntry(type="coupon")
│  └─ QuickEntry(type="hot")
├─ RecommendSection
│  ├─ SectionTitle
│  └─ RecommendProductGrid
│     └─ RecommendProductCard[]
├─ PromoBannerRow
│  └─ PromoBanner[]
└─ AppTabBar(active="home")
```

主要数据：

```ts
type HomeViewModel = {
  store: StoreSummary;
  member: MemberSummary;
  serviceModes: ServiceMode[];
  quickEntries: QuickEntry[];
  recommendProducts: ProductSummary[];
  banners: PromoBanner[];
};
```

关键事件：

- `tapStore`：进入门店选择或门店详情。
- `tapServiceMode`：进入点餐页并带上 `dineIn | delivery`。
- `tapRecommendProduct`：进入商品规格页。
- `tapQuickEntry`：进入活动、券包、积分或热门分类。

### 4.2 点餐页 MenuPage

```text
MenuPage
├─ AppNavBar
│  ├─ BackButton
│  ├─ SearchButton
│  └─ WechatCapsule
├─ StoreHeader
│  ├─ StoreName
│  ├─ DistanceText
│  └─ DineInTag
├─ MenuLayout
│  ├─ CategorySidebar
│  │  └─ CategoryItem[]
│  └─ MenuProductList
│     └─ MenuProductItem[]
│        ├─ ProductImage
│        ├─ ProductName
│        ├─ ProductTag
│        ├─ PriceText
│        ├─ OriginalPrice
│        └─ SelectSpecButton
└─ CartCheckoutBar
   ├─ CartBagIcon
   ├─ CartPriceSummary
   └─ CheckoutButton
```

主要数据：

```ts
type MenuViewModel = {
  store: StoreSummary;
  categories: MenuCategory[];
  activeCategoryId: string;
  products: ProductSummary[];
  cart: CartSummary;
};
```

关键事件：

- `selectCategory(categoryId)`：切换左侧分类。
- `selectProduct(productId)`：打开规格页。
- `addSimpleProduct(productId)`：无规格商品直接加入购物车。
- `checkout()`：进入提交订单页。

### 4.3 商品规格页 ProductSpecPage

```text
ProductSpecPage
├─ AppNavBar
│  ├─ BackButton
│  └─ WechatCapsule
├─ ProductHero
│  ├─ MainProductImage
│  └─ ComboImageStack
├─ ProductSpecHeader
│  ├─ ProductName
│  ├─ QuantityStepper
│  └─ ProductTag
├─ OptionGroup[]
│  ├─ OptionGroupTitle
│  └─ OptionCard[]
│     ├─ OptionImage
│     ├─ OptionName
│     └─ RadioIndicator
└─ SpecActionBar
   ├─ SelectedThumbList
   ├─ BuyNowButton
   └─ AddToCartButton
```

主要数据：

```ts
type ProductSpecViewModel = {
  product: ProductDetail;
  quantity: number;
  optionGroups: OptionGroup[];
  selectedOptions: SelectedOption[];
  pricePreview: PricePreview;
};
```

关键事件：

- `changeQuantity(quantity)`：修改数量。
- `selectOption(groupId, optionId)`：选择规格。
- `buyNow()`：带当前规格进入提交订单。
- `addToCart()`：加入购物车并回到点餐页或停留当前页。

### 4.4 提交订单页 CheckoutPage

```text
CheckoutPage
├─ AppNavBar
│  ├─ BackButton
│  ├─ Title("提交订单")
│  └─ WechatCapsule
├─ CheckoutStoreCard
│  ├─ StoreName
│  ├─ DistanceText
│  ├─ StoreAddress
│  ├─ ServiceModeSelector
│  │  ├─ ServiceModeOption(type="dineIn")
│  │  └─ ServiceModeOption(type="takeaway")
│  └─ PickupTimeRow
├─ CheckoutProductSection
│  ├─ CheckoutProductCard
│  └─ ExpandSpecsButton
├─ AddOnSection
│  ├─ SectionTitle
│  └─ AddOnList
│     └─ AddOnCard[]
├─ AmountSection
│  ├─ AmountLine(type="goods")
│  └─ CouponStrip
└─ PayBar
   ├─ TotalAmount
   └─ PayButton
```

主要数据：

```ts
type CheckoutViewModel = {
  store: StoreSummary;
  serviceMode: "dineIn" | "takeaway";
  pickupTime: PickupTime;
  items: CartItem[];
  addOns: AddOnProduct[];
  coupon: CouponPreview | null;
  amount: OrderAmount;
};
```

关键事件：

- `changeServiceMode(mode)`：切换堂食/外带。
- `changePickupTime()`：选择取餐时间。
- `addAddOn(productId)`：添加换购商品。
- `submitOrder()`：创建订单并调起支付。

### 4.5 订单列表页 OrderListPage

```text
OrderListPage
├─ AppNavBar
│  ├─ BackButton
│  └─ WechatCapsule
├─ OrderStatusTabs
│  ├─ Tab("当前订单")
│  └─ Tab("历史订单")
├─ OrderList
│  └─ OrderHistoryCard[]
│     ├─ DineInBadge
│     ├─ StoreName
│     ├─ OrderStatus
│     ├─ OrderTime
│     ├─ OrderProductThumbs
│     ├─ OrderAmount
│     ├─ ProductCount
│     └─ ReorderButton
└─ EmptyOrderState
```

主要数据：

```ts
type OrderListViewModel = {
  activeTab: "current" | "history";
  orders: OrderSummary[];
};
```

关键事件：

- `switchTab(tab)`：切换当前订单/历史订单。
- `tapOrder(orderId)`：进入订单详情。
- `reorder(orderId)`：复购，重新生成购物车草稿。

### 4.6 订单详情页 OrderDetailPage

```text
OrderDetailPage
├─ AppNavBar
│  ├─ BackButton
│  ├─ Title("订单详情")
│  └─ WechatCapsule
├─ OrderDetailStatus
│  ├─ StatusTitle
│  └─ RewardPill
├─ PromoSkeletonBanner
├─ OrderDetailGoodsCard
│  ├─ StoreName
│  ├─ StoreActions
│  ├─ OrderDetailItem[]
│  ├─ GoodsAmount
│  ├─ DiscountLine
│  └─ PayableAmount
├─ OrderInfoCard
│  └─ OrderInfoRow[]
└─ ReorderBar
```

主要数据：

```ts
type OrderDetail = OrderSummary & {
  storeAddress: string;
  rewardPoints: number;
  goodsAmount: number;
  discountTitle: string;
  discountAmount: number;
  pickupNo: string;
  expectedTime: string;
  servedAt: string;
  paymentMethod: string;
  remark: string;
  items: OrderDetailItem[];
  infoRows: OrderInfoRow[];
};
```

关键事件：

- `tapBack()`：返回订单列表。
- `tapReorder(orderId)`：从已完成订单重新生成购物车草稿。
- `tapCopyOrderNo(orderNo)`：复制订单编号。

### 4.7 个人中心 ProfilePage

```text
ProfilePage
├─ AppNavBar
│  └─ WechatCapsule
├─ ProfileHeader
│  ├─ Avatar
│  ├─ MemberLevel
│  └─ MaskedPhone
├─ MemberBenefitCard
│  ├─ BenefitTitle
│  ├─ BenefitDescription
│  └─ MemberStats
│     ├─ OrderCount
│     └─ ConsumptionAmount
├─ AssetCards
│  ├─ AssetCard(type="balance")
│  └─ AssetCard(type="coupon")
├─ ManageGrid
│  ├─ ManageEntry(type="orders")
│  ├─ ManageEntry(type="address")
│  ├─ ManageEntry(type="favorites")
│  └─ ManageEntry(type="transactions")
└─ AppTabBar(active="profile")
```

主要数据：

```ts
type ProfileViewModel = {
  user: UserProfile;
  member: MemberSummary;
  assets: MemberAssets;
  manageEntries: ManageEntry[];
};
```

关键事件：

- `login()`：未登录时授权登录。
- `tapBalance()`：进入余额/充值。
- `tapCoupon()`：进入优惠券。
- `tapManageEntry(type)`：进入订单、地址、收藏或交易记录。

## 5. 跨页面公共组件

### 5.1 AppNavBar

职责：

- 统一顶部安全区、返回按钮、页面标题、搜索入口、微信胶囊位置。
- 页面只传入是否显示返回、标题、左侧扩展插槽。

建议 props：

```ts
type AppNavBarProps = {
  title?: string;
  showBack?: boolean;
  showSearch?: boolean;
  storeName?: string;
};
```

### 5.2 AppTabBar

职责：

- 统一底部主导航。
- 设计稿当前导航为 `首页 / 点单 / 订单 / 我的`。
- 订单列表作为主 tab 承接当前订单和历史订单切换。

建议 props：

```ts
type AppTabBarProps = {
  active: "home" | "menu" | "orders" | "profile";
};
```

### 5.3 PriceText

职责：

- 统一价格符号、字号、划线原价、优惠价。
- 避免每个页面重复拼接 `¥`、原价和一口价。

建议 props：

```ts
type PriceTextProps = {
  price: number;
  originalPrice?: number;
  suffix?: string;
  size?: "small" | "normal" | "large";
};
```

### 5.4 QuantityStepper

职责：

- 统一加减按钮、禁用态、最小值和最大值。
- 商品规格页、购物车、换购卡片都可复用。

建议 props：

```ts
type QuantityStepperProps = {
  modelValue: number;
  min?: number;
  max?: number;
  disabled?: boolean;
};
```

事件：

- `update:modelValue`
- `increase`
- `decrease`

## 6. 数据模型建议

### 6.1 门店

```ts
type StoreSummary = {
  id: string;
  name: string;
  address: string;
  distanceText?: string;
  businessStatus: "open" | "closed" | "busy";
  supportModes: Array<"dineIn" | "takeaway" | "delivery">;
};
```

### 6.2 商品

```ts
type ProductSummary = {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  originalPrice?: number;
  tags?: string[];
  hasSpec: boolean;
  soldOut?: boolean;
};

type ProductDetail = ProductSummary & {
  description?: string;
  optionGroups: OptionGroup[];
};

type OptionGroup = {
  id: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
  options: ProductOption[];
};

type ProductOption = {
  id: string;
  name: string;
  imageUrl?: string;
  priceDelta?: number;
  selected?: boolean;
};
```

### 6.3 购物车

```ts
type CartSummary = {
  itemCount: number;
  totalAmount: number;
  discountAmount?: number;
  items: CartItem[];
};

type CartItem = {
  id: string;
  productId: string;
  productName: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  selectedOptions: SelectedOption[];
};

type SelectedOption = {
  groupId: string;
  optionId: string;
  name: string;
  priceDelta?: number;
};
```

### 6.4 订单

```ts
type OrderSummary = {
  id: string;
  storeName: string;
  serviceMode: "dineIn" | "takeaway" | "delivery";
  status: "pendingPay" | "paid" | "making" | "ready" | "finished" | "cancelled" | "refunding" | "refunded";
  createdAt: string;
  totalAmount: number;
  itemCount: number;
  productThumbs: string[];
};

type OrderAmount = {
  goodsAmount: number;
  discountAmount: number;
  couponAmount: number;
  payableAmount: number;
};
```

### 6.5 用户与会员

```ts
type UserProfile = {
  id: string;
  avatarUrl?: string;
  maskedPhone?: string;
  loggedIn: boolean;
};

type MemberSummary = {
  levelName: string;
  points: number;
  couponCount: number;
  orderCount: number;
  consumptionAmount: number;
};

type MemberAssets = {
  balance: number;
  couponCount: number;
};
```

## 7. 开发优先级

建议按复用程度和主链路优先级实现：

1. 基础组件：`AppNavBar`、`AppTabBar`、`PriceText`、`QuantityStepper`。
2. 点餐主链路：`StoreHeader`、`CategorySidebar`、`MenuProductItem`、`CartCheckoutBar`。
3. 商品规格：`ProductHero`、`OptionGroup`、`OptionCard`、`SpecActionBar`。
4. 提交订单：`CheckoutStoreCard`、`CheckoutProductCard`、`AddOnList`、`PayBar`。
5. 首页模块：`StoreHero`、`MemberStrip`、`ServiceModeCards`、`RecommendSection`。
6. 订单和个人中心：`OrderHistoryCard`、`MemberBenefitCard`、`AssetCards`、`ManageGrid`。

## 8. 与当前工程的迁移关系

| 当前文件 | 建议演进 |
| --- | --- |
| `layout/layout.vue` | 改为 `AppShell + AppTabBar`，底部导航文案改为 `首页 / 点单 / 订单 / 我的`。 |
| `components/card.vue` | 当前更像旧订单卡片，建议迁移为 `orders/OrderHistoryCard.vue` 或废弃重写。 |
| `pages/home/home.vue` | 替换为 `HomePage` 组件树。 |
| `pages/order/order.vue` | 替换为 `MenuPage` 组件树。 |
| `pages/his/his.vue` | 替换为 `OrderListPage` 组件树。 |
| `pages/user/user.vue` | 替换为 `ProfilePage` 组件树。 |
| `pages.json` | 新增 `pages/spec/spec` 和 `pages/checkout/checkout`。 |

## 9. 验收标准

- 每个页面只负责组装数据和业务组件，不直接写复杂卡片结构。
- 所有价格、按钮、标签、卡片圆角和背景色使用 `theme/miniapp-tokens.*`。
- 点餐、规格、提交订单、订单列表、个人中心可以独立 Mock 数据渲染。
- 组件 props 命名稳定，事件向上抛出，不在展示组件里直接调接口。
- 商品、订单、用户、会员资产类型在 `types/` 中集中维护。
