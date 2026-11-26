const legacyImageNotice = /商品图片为\s*AI\s*生成示意图\s*[，,]\s*餐品以实际出品为准[。.!！]?/gi;

export function productDescription(description?: string | null): string {
  return description?.replace(legacyImageNotice, '').trim() ?? '';
}
