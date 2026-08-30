import type { MenuContract, ProductRecordContract } from "@lingdian/contracts";
import type { ProductDetail, ProductSummary } from "@/types/menu";
import type { ServiceMode, StoreSummary } from "@/types/store";
import { request } from "./request";
import { resolveProductImage } from "./product-image";

export type MenuViewModel = {
  store: StoreSummary;
  categories: Array<{ id: string; name: string }>;
  products: ProductSummary[];
  productDetails: Record<string, ProductDetail>;
};

let cachedMenu: MenuViewModel | null = null;
let cachedMenuAt = 0;
let pendingMenuRequest: Promise<MenuViewModel> | null = null;
let menuRequestGeneration = 0;
const MENU_CACHE_TTL_MS = 60 * 1000;

function mapProduct(product: ProductRecordContract, categoryName: string): ProductDetail {
  const sku = product.skus.find((item) => item.is_default && item.is_active) ?? product.skus.find((item) => item.is_active);
  const imageUrl = resolveProductImage(product.image_url, categoryName);
  const productBindings = product.selection_groups.filter((binding) =>
    binding.is_enabled && binding.group.is_active && binding.scope === "PRODUCT",
  );
  const variantBindings = product.selection_groups.filter((binding) =>
    binding.is_enabled &&
    binding.group.is_active &&
    binding.scope === "VARIANT" &&
    binding.target_variant_id === sku?.id,
  );
  const bindingsByGroupId = new Map(
    [...productBindings, ...variantBindings].map((binding) => [binding.group.id, binding]),
  );

  return {
    id: product.id,
    skuId: sku?.id ?? "",
    categoryId: product.category_id,
    name: product.name,
    description: product.description ?? "",
    imageUrl,
    price: sku?.price ?? product.price,
    tags: product.is_featured ? ["推荐"] : [],
    hasSpec: bindingsByGroupId.size > 0,
    comboImages: [imageUrl],
    optionGroups: [...bindingsByGroupId.values()].map((binding) => ({
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
    })),
  };
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
      const detail = mapProduct(product, category.name);
      productDetails[detail.id] = detail;
      return detail;
    }),
  );

  return {
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
  if (!options.force && cachedMenu && Date.now() - cachedMenuAt < MENU_CACHE_TTL_MS) {
    return cachedMenu;
  }
  if (!options.force && pendingMenuRequest) return pendingMenuRequest;

  const requestGeneration = ++menuRequestGeneration;
  const loadMenu = async (): Promise<MenuViewModel> => {
    const menu = await request<MenuContract>("/menu/current", { requiresAuth: false });
    const mappedMenu = mapMenu(menu);
    if (requestGeneration === menuRequestGeneration) {
      cachedMenu = mappedMenu;
      cachedMenuAt = Date.now();
    }
    return mappedMenu;
  };

  const requestPromise = loadMenu();
  pendingMenuRequest = requestPromise;
  try {
    return await requestPromise;
  } catch (error) {
    if (cachedMenu) return cachedMenu;
    throw error;
  } finally {
    if (pendingMenuRequest === requestPromise) pendingMenuRequest = null;
  }
}

export function invalidateMenuCache() {
  menuRequestGeneration += 1;
  cachedMenu = null;
  cachedMenuAt = 0;
  pendingMenuRequest = null;
}

export async function getProductDetail(productId: string) {
  if (!cachedMenu) {
    await fetchMenu();
  }
  return cachedMenu?.productDetails[productId] ?? null;
}

export async function getCurrentStoreId() {
  if (!cachedMenu) {
    await fetchMenu();
  }
  return cachedMenu?.store.id ?? "";
}
