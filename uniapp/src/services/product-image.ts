import { ASSET_BASE, buildAssetUrl } from "../config/api";

const FALLBACK_IMAGES = {
  burger: "/static/products/milk-green.jpg",
  snack: "/static/products/grapefruit.jpg",
  drink: "/static/products/lime.jpg",
  combo: "/static/products/pearl-green.jpg",
} as const;

export function resolveProductImage(
  url: string | null | undefined,
  categoryName: string,
  assetBase = ASSET_BASE,
): string {
  const isReservedExampleUrl = /^https?:\/\/(?:www\.)?example\.(?:com|org|net)\//i.test(url ?? "");
  if (!isReservedExampleUrl) {
    if (url?.startsWith("http") || url?.startsWith("/static")) return url;
    if (url) {
      if (assetBase === ASSET_BASE) return buildAssetUrl(url);
      return `${assetBase.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
    }
  }

  const normalizedCategory = categoryName.toLowerCase();
  if (/drink|饮|茶|咖啡|可乐|果汁/.test(normalizedCategory)) return FALLBACK_IMAGES.drink;
  if (/snack|小食|炸鸡|薯|鸡块/.test(normalizedCategory)) return FALLBACK_IMAGES.snack;
  if (/combo|套餐|组合|双人|单人/.test(normalizedCategory)) return FALLBACK_IMAGES.combo;
  return FALLBACK_IMAGES.burger;
}
