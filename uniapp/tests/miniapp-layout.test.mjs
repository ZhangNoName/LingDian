import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readProjectFile(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

test("miniapp layout foundation uses safe-area tokens", async () => {
  const tokens = await readProjectFile("../theme/miniapp-tokens.css");

  assert.match(tokens, /--ld-nav-safe-height:/);
  assert.match(tokens, /--ld-page-bottom-safe:/);
  assert.match(tokens, /--ld-fixed-action-height:/);
});

test("layout is the only owner of the top safe area", async () => {
  const [layout, navBar] = await Promise.all([
    readProjectFile("src/layout/layout.vue"),
    readProjectFile("src/components/app/AppNavBar.vue"),
  ]);

  assert.match(layout, /height: 100vh/);
  assert.doesNotMatch(layout, /min-height: 100vh/);
  assert.match(layout, /<AppTabBar v-if="showTabBar"/);
  assert.match(layout, /padding-top: var\(--status-bar-height, 0px\)/);
  assert.doesNotMatch(layout, /safe-area-inset-top/);
  assert.doesNotMatch(navBar, /safe-area-inset-top/);
});

test("page chrome uses the shared header slot", async () => {
  const pages = ["home/home", "order/order", "his/his", "user/user", "spec/spec", "checkout/checkout", "order-detail/order-detail", "address/address"];
  const contents = await Promise.all(pages.map((page) => readProjectFile(`src/pages/${page}.vue`)));

  for (const content of contents) {
    assert.match(content, /<Layout/);
  }

  for (const content of contents.slice(1)) {
    assert.match(content, /<template #header>\s*<AppNavBar/);
  }

  for (const content of contents.slice(4)) {
    assert.match(content, /<Layout :show-tab-bar="false"/);
  }
});

test("navigation uses the shared SVG image renderer", async () => {
  const navBar = await readProjectFile("src/components/app/AppNavBar.vue");
  const renderer = await readProjectFile("src/components/app/AppIcon.vue");
  assert.match(navBar, /<AppIcon name="back"/);
  assert.match(renderer, /<image/);
  assert.match(renderer, /:src="images\[name\]\[tone\]"/);
});

test("order page uses uni-app lifecycle hooks", async () => {
  const orderPage = await readProjectFile("src/pages/order/order.vue");

  assert.match(orderPage, /import \{ onLoad, onReady, onShow, onUnload \} from "@dcloudio\/uni-app"/);
  assert.match(orderPage, /onLoad\(\(query\) => \{[\s\S]*parseServiceMode\(query\?\.mode\)[\s\S]*void loadMenu\(\)/);
  assert.doesNotMatch(orderPage, /onMounted\(/);
  assert.doesNotMatch(orderPage, /onUnmounted\(/);
});

test("home page does not use Vue mounted lifecycle", async () => {
  const homePage = await readProjectFile("src/pages/home/home.vue");

  assert.match(homePage, /import \{ onLoad, onShow \} from "@dcloudio\/uni-app"/);
  assert.match(homePage, /onLoad\(/);
  assert.doesNotMatch(homePage, /onMounted\(/);
});

test("home and profile components avoid unsupported WXSS selectors", async () => {
  const files = [
    "src/pages/home/home.vue",
    "src/components/home/MemberStrip.vue",
    "src/components/home/RecommendSection.vue",
    "src/components/profile/ManageGrid.vue",
  ];

  const contents = await Promise.all(files.map(readProjectFile));
  for (const content of contents) {
    assert.doesNotMatch(content, /:deep\(|:not\(|\.[\w-]+\s+(text|view|image|button)/);
  }
});

test("service entry cards use static Lucide icons", async () => {
  const cards = await readProjectFile("src/components/app/ServiceModeCards.vue");

  assert.match(cards, /<AppIcon :name="mode.key"/);
});

test("menu page uses the shared tab layout and a safe scrolling area", async () => {
  const [orderPage, cartBar] = await Promise.all([
    readProjectFile("src/pages/order/order.vue"),
    readProjectFile("src/components/menu/CartCheckoutBar.vue"),
  ]);

  assert.match(orderPage, /<Layout active="menu" :scroll-content="false"/);
  assert.match(orderPage, /<scroll-view\s+class="product-list"\s+scroll-y/);
  assert.match(orderPage, /@scrolltolower="loadMoreProducts"/);
  assert.match(orderPage, /v-for="section in visibleMenuSections"/);
  assert.match(orderPage, /<template #footer>\s*<CartCheckoutBar v-if="hasCart"/);
  assert.match(orderPage, /<template #overlay>\s*<CartDrawer/);
  assert.doesNotMatch(cartBar, /position:\s*fixed/);
  assert.doesNotMatch(orderPage, /height: 100vh|:deep\(/);
});

test("wechat build pins the simulator-compatible base library", async () => {
  const manifest = await readProjectFile("src/manifest.json");

  assert.match(manifest, /"mp-weixin"\s*:\s*\{[\s\S]*?"libVersion"\s*:\s*"3\.15\.2"/);
});

test("menu labels contain long text without expanding their columns", async () => {
  const [sidebar, productItem] = await Promise.all([
    readProjectFile("src/components/menu/CategorySidebar.vue"),
    readProjectFile("src/components/menu/MenuProductItem.vue"),
  ]);

  assert.match(sidebar, /class="category-name"/);
  assert.match(sidebar, /\.category-name\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(sidebar, /\.category-name\s*\{[\s\S]*?-webkit-line-clamp:\s*2/);
  assert.match(productItem, /\.name\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(productItem, /\.name\s*\{[\s\S]*?-webkit-line-clamp:\s*2/);
});

test("home and menu product images have a static failure state", async () => {
  const [recommend, productItem] = await Promise.all([
    readProjectFile("src/components/home/RecommendSection.vue"),
    readProjectFile("src/components/menu/MenuProductItem.vue"),
  ]);

  for (const component of [recommend, productItem]) {
    assert.match(component, /<ProductThumbnail :src="product.imageUrl"/);
  }
  const thumbnail = await readProjectFile("src/components/app/ProductThumbnail.vue");
  assert.match(thumbnail, /图片待更新/);
  assert.match(thumbnail, /@error=/);
  assert.match(thumbnail, /class="image-placeholder"/);
  assert.match(thumbnail, /mode="aspectFit"/);
  assert.doesNotMatch(thumbnail, /mode="aspectFill"/);
});

test("menu and specification controls use static Lucide icons", async () => {
  const [cartBar, stepper] = await Promise.all([
    readProjectFile("src/components/menu/CartCheckoutBar.vue"),
    readProjectFile("src/components/app/QuantityStepper.vue"),
  ]);

  assert.match(cartBar, /<AppIcon name="cart"/);
  assert.match(stepper, /<AppIcon name="minus"/);
  assert.match(stepper, /<AppIcon name="plus"/);
});

test("page actions stay outside the shared scroll viewport", async () => {
  const [layout, checkoutPage, detailPage, specPage, addressPage, payBar, specBar] = await Promise.all([
    readProjectFile("src/layout/layout.vue"),
    ...["checkout/checkout", "order-detail/order-detail", "spec/spec", "address/address"].map((page) => readProjectFile(`src/pages/${page}.vue`)),
    readProjectFile("src/components/checkout/PayBar.vue"),
    readProjectFile("src/components/spec/SpecActionBar.vue"),
  ]);

  assert.match(layout, /<view class="page-header">\s*<slot name="header"\s*\/>\s*<\/view>\s*<scroll-view[^>]*class="page-content" scroll-y/);
  assert.match(layout, /<view class="page-footer">\s*<slot name="footer"\s*\/>\s*<AppTabBar/);
  assert.match(layout, /\.page-content\s*\{[^}]*flex:\s*1;[^}]*height:\s*0/);
  assert.match(checkoutPage, /<template #footer>\s*<PayBar/);
  assert.match(detailPage, /<template #footer>\s*<view v-if="canReorder"/);
  assert.match(specPage, /<template #footer>\s*<SpecActionBar v-if="productDetail"/);
  assert.match(addressPage, /<template #footer>\s*<view v-if="!creating"/);
  for (const source of [payBar, specBar, detailPage, addressPage]) {
    assert.doesNotMatch(source, /position:\s*fixed/);
    assert.match(source, /env\(safe-area-inset-bottom\)/);
  }
  assert.match(payBar, /min-height: var\(--ld-fixed-action-height/);
});

test("order history formats time and limits thumbnail density", async () => {
  const historyCard = await readProjectFile("src/components/orders/OrderHistoryCard.vue");

  assert.match(historyCard, /formatOrderTime\(order\.createdAt\)/);
  assert.match(historyCard, /order\.productThumbs\.slice\(0, 3\)/);
  assert.match(historyCard, /v-if="order\.pickupCardCode"/);
  assert.match(historyCard, /<AppActionButton[^>]+@activate="emitAction"/);
});

test("checkout and the cart drawer share product rows with class-only WXSS rules", async () => {
  const [productCard, cartDrawer, cartItemList] = await Promise.all([
    readProjectFile("src/components/checkout/CheckoutProductCard.vue"),
    readProjectFile("src/components/menu/CartDrawer.vue"),
    readProjectFile("src/components/app/CartItemList.vue"),
  ]);

  assert.match(productCard, /<CartItemList :items="items"/);
  assert.match(cartDrawer, /<CartItemList :items="cart.items"/);
  assert.doesNotMatch(cartItemList, /\.amount\s+text/);
  assert.match(cartItemList, /<QuantityStepper\s+:model-value="item.quantity"/);
  assert.match(cartItemList, /class="amount-price"/);
});
