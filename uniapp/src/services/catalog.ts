import type { MenuContract, ProductRecordContract } from "@lingdian/contracts";
import type { ProductDetail, ProductSummary } from "@/types/menu";
import type { StoreSummary } from "@/types/store";
import { request, resolveAssetUrl } from "./request";

export type MenuViewModel = {
  store: StoreSummary;
  categories: Array<{ id: string; name: string }>;
  products: ProductSummary[];
  productDetails: Record<string, ProductDetail>;
};

let cachedMenu: MenuViewModel | null = null;

function mapProduct(product: ProductRecordContract): ProductDetail {
  const sku = product.skus.find((item) => item.is_default && item.is_active) ?? product.skus.find((item) => item.is_active);
  const imageUrl = resolveAssetUrl(product.image_url);

  return {
    id: product.id,
    skuId: sku?.id ?? "",
    categoryId: product.category_id,
    name: product.name,
    description: product.description ?? "",
    imageUrl,
    price: sku?.price ?? product.price,
    tags: product.is_featured ? ["推荐"] : [],
    hasSpec: product.selection_groups.length > 0,
    comboImages: [imageUrl],
    optionGroups: product.selection_groups.map((binding) => ({
      id: binding.group.id,
      name: binding.group.name,
      required: binding.group.is_required,
      min: binding.group.min_select,
      max: binding.group.max_select,
      options: binding.group.options.map((option) => ({
        id: option.id,
        name: option.name,
        priceDelta: option.price_delta ?? 0,
      })),
    })),
  };
}

export async function fetchMenu() {
  const menu = await request<MenuContract>("/menu/current");
  const productDetails: Record<string, ProductDetail> = {};
  const products = menu.categories.flatMap((category) =>
    category.products.map((product) => {
      const detail = mapProduct(product);
      productDetails[detail.id] = detail;
      return detail;
    }),
  );

  cachedMenu = {
    store: {
      id: menu.store.id,
      name: menu.store.name,
      address: menu.store.businessHours ? `营业时间 ${menu.store.businessHours}` : "门店营业中",
      distanceText: "当前门店",
      businessStatus: menu.store.status === "open" ? "open" : "closed",
      supportModes: ["dineIn", "takeaway"],
    },
    categories: menu.categories.map((category) => ({ id: category.id, name: category.name })),
    products,
    productDetails,
  };

  return cachedMenu;
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
