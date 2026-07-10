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

test("tab layout stays viewport-bound and home clears the status bar", async () => {
  const [layout, homePage] = await Promise.all([
    readProjectFile("src/layout/layout.vue"),
    readProjectFile("src/pages/home/home.vue"),
  ]);

  assert.match(layout, /height: 100vh/);
  assert.doesNotMatch(layout, /min-height: 100vh/);
  assert.match(homePage, /padding-top: calc\(env\(safe-area-inset-top\) \+ 16rpx\)/);
});

test("navigation uses static Lucide icons", async () => {
  const navBar = await readProjectFile("src/components/app/AppNavBar.vue");

  assert.match(navBar, /import \{ BackIcon, SearchIcon \}/);
  assert.match(navBar, /<BackIcon/);
  assert.match(navBar, /<SearchIcon/);
});

test("order page uses uni-app lifecycle hooks", async () => {
  const orderPage = await readProjectFile("src/pages/order/order.vue");

  assert.match(orderPage, /import \{ onLoad, onShow, onUnload \} from "@dcloudio\/uni-app"/);
  assert.match(orderPage, /onLoad\(loadMenu\)/);
  assert.doesNotMatch(orderPage, /onMounted\(/);
  assert.doesNotMatch(orderPage, /onUnmounted\(/);
});

test("home page does not use Vue mounted lifecycle", async () => {
  const homePage = await readProjectFile("src/pages/home/home.vue");

  assert.match(homePage, /import \{ onLoad \} from "@dcloudio\/uni-app"/);
  assert.match(homePage, /onLoad\(/);
  assert.doesNotMatch(homePage, /onMounted\(/);
});

test("home and profile components avoid unsupported WXSS selectors", async () => {
  const files = [
    "src/pages/home/home.vue",
    "src/components/home/MemberStrip.vue",
    "src/components/home/RecommendSection.vue",
    "src/components/profile/ManageGrid.vue",
    "src/components/profile/MemberBenefitCard.vue",
  ];

  const contents = await Promise.all(files.map(readProjectFile));
  for (const content of contents) {
    assert.doesNotMatch(content, /:deep\(|:not\(|\.[\w-]+\s+(text|view|image|button)/);
  }
});

test("service entry cards use static Lucide icons", async () => {
  const cards = await readProjectFile("src/components/home/ServiceModeCards.vue");

  assert.match(cards, /<HomeDineInIcon/);
  assert.match(cards, /<HomeDeliveryIcon/);
});

test("menu page uses the shared tab layout and a safe scrolling area", async () => {
  const orderPage = await readProjectFile("src/pages/order/order.vue");

  assert.match(orderPage, /<Layout active="menu">/);
  assert.match(orderPage, /padding-bottom: calc\(var\(--ld-fixed-action-height/);
  assert.doesNotMatch(orderPage, /height: 100vh|:deep\(/);
});

test("menu and specification controls use static Lucide icons", async () => {
  const [cartBar, stepper] = await Promise.all([
    readProjectFile("src/components/menu/CartCheckoutBar.vue"),
    readProjectFile("src/components/spec/QuantityStepper.vue"),
  ]);

  assert.match(cartBar, /<CartIcon/);
  assert.match(stepper, /<MinusIcon/);
  assert.match(stepper, /<PlusIcon/);
});

test("checkout reserves room for a safe fixed payment action", async () => {
  const [checkoutPage, payBar] = await Promise.all([
    readProjectFile("src/pages/checkout/checkout.vue"),
    readProjectFile("src/components/checkout/PayBar.vue"),
  ]);

  assert.match(checkoutPage, /padding-bottom: calc\(var\(--ld-fixed-action-height/);
  assert.match(payBar, /min-height: var\(--ld-fixed-action-height/);
  assert.match(payBar, /env\(safe-area-inset-bottom\)/);
});

test("order history formats time and limits thumbnail density", async () => {
  const historyCard = await readProjectFile("src/components/orders/OrderHistoryCard.vue");

  assert.match(historyCard, /function formatOrderTime/);
  assert.match(historyCard, /order\.productThumbs\.slice\(0, 3\)/);
  assert.match(historyCard, /<ChevronRightIcon/);
});

test("checkout product card keeps WXSS rules class-only", async () => {
  const productCard = await readProjectFile("src/components/checkout/CheckoutProductCard.vue");

  assert.doesNotMatch(productCard, /\.amount\s+text/);
  assert.match(productCard, /class="amount-quantity"/);
  assert.match(productCard, /class="amount-price"/);
});
