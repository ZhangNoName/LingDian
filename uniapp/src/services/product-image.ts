import { ASSET_BASE, buildAssetUrl } from "../config/api";

export function resolveProductImage(
  url: string | null | undefined,
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

  return "";
}
