import type { MenuContract, ProductRecordContract } from "@lingdian/contracts";
import type { ProductDetail, ProductSummary } from "@/types/menu";
import type { ServiceMode, StoreSummary } from "@/types/store";
import { API_BASE } from "@/config/api";
import { request } from "./request";
import { resolveProductImage } from "./product-image";

export type MenuViewModel = {
  paymentRequired?: boolean;
  store: StoreSummary;
  categories: Array<{ id: string; name: string }>;
  products: ProductSummary[];
  productDetails: Record<string, ProductDetail>;
};

let cachedMenu: MenuViewModel | null = null;
let cachedMenuAt: number | undefined;
let menuSnapshotChecked = false;
let pendingMenuRequest: Promise<MenuViewModel> | null = null;
let menuRequestGeneration = 0;
const MENU_CACHE_TTL_MS = 60 * 1000;
const MENU_SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000;
const MENU_SNAPSHOT_KEY = `lingdian:public-menu:v1:${API_BASE}`;
const LEGACY_PRODUCT_IMAGE_NOTICE = "商品图片为 AI 生成示意图，餐品以实际出品为准。";

type MenuSnapshot = {
  savedAt: number;
  menu: MenuContract;
};

function mapProduct(product: ProductRecordContract): ProductDetail {
  const imageUrl = resolveProductImage(product.image_url);
  const description = product.description ?? "";
  const skus = product.skus.filter((sku) => sku.is_active);
  const defaultSku = skus.find((sku) => sku.is_default) ?? skus[0];
  const variants = skus.map((sku) => ({
    id: sku.id,
    name: sku.sku_name,
    price: sku.price,
    optionGroups: mapOptionGroups(product, sku.id),
  }));
  const variant = variants.find((item) => item.id === defaultSku?.id);
  const optionGroups = variant?.optionGroups ?? mapOptionGroups(product);

  return {
    id: product.id,
    skuId: variant?.id ?? "",
    skuName: variant?.name,
    variants,
    categoryId: product.category_id,
    name: product.name,
    description: description.trim() === LEGACY_PRODUCT_IMAGE_NOTICE ? "以实际出品为准" : description,
    imageUrl,
    price: variant?.price ?? product.price,
    tags: product.is_featured ? ["推荐"] : [],
    hasSpec: variants.length > 1 || optionGroups.length > 0,
    comboImages: [],
    optionGroups,
  };
}

function mapOptionGroups(product: ProductRecordContract, skuId?: string): ProductDetail["optionGroups"] {
  const enabled = product.selection_groups.filter((binding) => binding.is_enabled && binding.group.is_active);
  const productBindings = enabled.filter((binding) => binding.scope === "PRODUCT");
  const variantBindings = enabled.filter((binding) => binding.scope === "VARIANT" && binding.target_variant_id === skuId);
  const bindingsByGroupId = new Map(
    [...productBindings, ...variantBindings].map((binding) => [binding.group.id, binding]),
  );
  return [...bindingsByGroupId.values()].map((binding) => ({
      id: binding.group.id,
      name: binding.group.name,
      required: binding.group.is_required,
      selectionMode: binding.group.selection_mode,
      min: binding.group.min_select,
      max: binding.group.max_select,
      options: binding.group.options.filter((option) => option.is_active).map((option) => ({
        id: option.id,
        name: option.name,
        priceDelta: option.price_delta ?? 0,
        isDefault: option.is_default,
      })),
  }));
}

function resolveSupportedModes(store: MenuContract["store"]): ServiceMode[] {
  const modes: ServiceMode[] = [];
  if (store.dineInEnabled !== false) modes.push("dineIn");
  if (store.pickupEnabled !== false) modes.push("takeaway");
  if (store.takeoutEnabled === true) modes.push("delivery");
  return modes;
}

function mapMenu(menu: MenuContract): MenuViewModel {
  const productDetails: Record<string, ProductDetail> = {};
  const products = menu.categories.flatMap((category) =>
    category.products.map((product) => {
      const detail = mapProduct(product);
      productDetails[detail.id] = detail;
      return detail;
    }),
  );

  return {
    paymentRequired: menu.paymentRequired,
    store: {
      id: menu.store.id,
      name: menu.store.name,
      businessText: menu.store.businessHours ? `营业时间 ${menu.store.businessHours}` : "营业时间未记录",
      distanceText: "当前门店",
      businessStatus: menu.store.status.toLowerCase() === "open" ? "open" : "closed",
      supportModes: resolveSupportedModes(menu.store),
    },
    categories: menu.categories.map((category) => ({ id: category.id, name: category.name })),
    products,
    productDetails,
  };
}

export async function fetchMenu(options: { force?: boolean } = {}): Promise<MenuViewModel> {
  const preview = peekMenu();
  if (!options.force && preview && cachedMenuAt !== undefined && Date.now() - cachedMenuAt < MENU_CACHE_TTL_MS) {
    return preview;
  }
  if (!options.force && pendingMenuRequest) return pendingMenuRequest;

  const requestGeneration = ++menuRequestGeneration;
  const loadMenu = async (): Promise<MenuViewModel> => {
    const menu = await request<MenuContract>("/menu/current", { requiresAuth: false });
    const mappedMenu = mapMenu(menu);
    if (requestGeneration === menuRequestGeneration) {
      cachedMenu = mappedMenu;
      cachedMenuAt = Date.now();
      saveMenuSnapshot({ menu, savedAt: cachedMenuAt });
    }
    return mappedMenu;
  };

  const requestPromise = loadMenu();
  pendingMenuRequest = requestPromise;
  try {
    return await requestPromise;
  } catch (error) {
    if (cachedMenu && !options.force) return cachedMenu;
    throw error;
  } finally {
    if (pendingMenuRequest === requestPromise) pendingMenuRequest = null;
  }
}

export function invalidateMenuCache() {
  menuRequestGeneration += 1;
  cachedMenu = null;
  cachedMenuAt = undefined;
  menuSnapshotChecked = true;
  pendingMenuRequest = null;
  try {
    uni.removeStorageSync(MENU_SNAPSHOT_KEY);
  } catch {
    // Storage may be unavailable to this runtime.
  }
}

export function peekMenu(): MenuViewModel | null {
  if (!menuSnapshotChecked) {
    menuSnapshotChecked = true;
    try {
      const snapshot = uni.getStorageSync(MENU_SNAPSHOT_KEY) as MenuSnapshot | undefined;
      if (snapshot?.menu && typeof snapshot.savedAt === "number") {
        const age = Date.now() - snapshot.savedAt;
        if (age >= 0 && age < MENU_SNAPSHOT_MAX_AGE_MS) cachedMenu = mapMenu(snapshot.menu);
      }
    } catch {
      // A missing or unreadable snapshot falls back to the network.
    }
  }
  return cachedMenu;
}

function saveMenuSnapshot(data: MenuSnapshot) {
  try {
    uni.setStorage({ key: MENU_SNAPSHOT_KEY, data, fail: () => {} });
  } catch {
    // The in-memory menu remains available when local storage fails.
  }
}

export async function getProductDetail(productId: string) {
  const preview = peekMenu()?.productDetails[productId];
  if (preview && cachedMenuAt !== undefined) return preview;
  const menu = await fetchMenu();
  return menu.productDetails[productId] ?? null;
}

export async function getCurrentStoreId() {
  if (!cachedMenu) {
    await fetchMenu();
  }
  return cachedMenu?.store.id ?? "";
}
