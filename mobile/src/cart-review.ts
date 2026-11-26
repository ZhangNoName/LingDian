import type { MenuContract, ProductRecordContract, ProductSkuContract } from '@lingdian/contracts';
import type { CartLine } from './cart-state';

export function groupsFor(product: ProductRecordContract, skuId: string) {
  const groups = product.selection_groups.filter((binding) => binding.is_enabled && binding.group.is_active);
  return [...new Map([
    ...groups.filter((binding) => binding.scope === 'PRODUCT'),
    ...groups.filter((binding) => binding.scope === 'VARIANT' && binding.target_variant_id === skuId),
  ].map(({ group }) => [group.id, group])).values()];
}

export type AvailableLine = { line: CartLine; cents: number; productName: string; variantName: string; options: string[] };
export type ReviewedLine = AvailableLine | { line: CartLine; issue: string; editableProductId?: string };

export function reviewCart(lines: CartLine[], menu: MenuContract): ReviewedLine[] {
  const products = new Set<string>();
  const variants = new Map<string, { product: ProductRecordContract; sku: ProductSkuContract }>();
  for (const category of menu.categories) {
    for (const product of category.products) {
      if (product.store_id !== menu.store.id || product.status !== 'ACTIVE') continue;
      for (const sku of product.skus) {
        if (!sku.is_active) continue;
        products.add(product.id);
        variants.set(sku.id, { product, sku });
      }
    }
  }
  return lines.map((line) => {
    if (line.storeId !== menu.store.id) return { line, issue: '该商品属于其他门店。' };
    const current = variants.get(line.skuId);
    if (!current) return line.productId && products.has(line.productId)
      ? { line, issue: '原规格已停售，请重新选择。', editableProductId: line.productId }
      : { line, issue: '商品或规格已停售。' };
    const { product, sku } = current;
    const invalid = (issue: string) => ({ line, issue, editableProductId: product.id });
    const groups = groupsFor(product, sku.id);
    const selected = new Map<string, string[]>();
    for (const selection of line.selections) {
      const options = selected.get(selection.selectionGroupId) ?? [];
      options.push(selection.selectionOptionId);
      selected.set(selection.selectionGroupId, options);
    }
    let cents = Math.round(sku.price * 100);
    const options: string[] = [];
    for (const group of groups) {
      const ids = selected.get(group.id) ?? [];
      const minimum = Math.max(group.min_select, group.is_required ? 1 : 0);
      const maximum = group.selection_mode === 'SINGLE' ? Math.min(1, group.max_select) : group.max_select;
      if (ids.length < minimum || ids.length > maximum) return invalid('选项要求已更新，请重新选择。');
      for (const id of ids) {
        const option = group.options.find((item) => item.id === id && item.is_active);
        if (!option) return invalid('所选选项已停售，请重新选择。');
        cents += Math.round(option.price_delta * 100);
        options.push(option.name);
      }
      selected.delete(group.id);
    }
    if (selected.size) return invalid('所选选项已变更，请重新选择。');
    if (!Number.isSafeInteger(cents) || cents < 0 || cents > 9_999_999_999) return invalid('当前规格价格不可用。');
    return { line, cents, productName: product.name, variantName: sku.sku_name, options };
  });
}
