import assert from 'node:assert/strict';
import test from 'node:test';
import type { MenuContract, ProductRecordContract } from '@lingdian/contracts';
import { reviewCart } from '../src/cart-review';
import type { CartLine } from '../src/cart-state';

const line: CartLine = {
  id: 'line', selectionKey: 'selection', storeId: 'store', skuId: 'sku', quantity: 2,
  productName: '旧商品名称', variantName: '旧规格', image: undefined, cents: 500, options: ['旧选项'],
  selections: [{ selectionGroupId: 'group', selectionOptionId: 'option' }],
};

function menu(): MenuContract {
  const product: ProductRecordContract = {
    id: 'product', name: '新商品名称', store_id: 'store', category_id: 'category', category: '餐食', type: 'SINGLE',
    description: null, image_url: null, is_active: true, is_featured: false, status: 'ACTIVE', price: 6.20, stock: 0,
    skus: [{ id: 'sku', product_id: 'product', sku_name: '新规格', price: 6.20, stock_count: 0, is_default: true, is_active: true }],
    selection_groups: [{ binding_id: 'binding', scope: 'VARIANT', target_variant_id: 'sku', sort_order: 0, is_enabled: true, group: {
      id: 'group', name: '加料', group_type: 'MODIFIER', selection_mode: 'SINGLE', min_select: 0, max_select: 1, is_required: true,
      is_active: true, sort_order: 0, description: null, options: [{
        id: 'option', name: '新选项', option_type: 'VALUE', price_delta: 0.35, stock_delta: 0, is_default: false,
        is_active: true, sort_order: 0, referenced_product_id: null, referenced_product_name: null, referenced_sku_id: null, referenced_sku_name: null,
      }],
    } }],
  };
  return { store: { id: 'store', name: '测试门店', status: 'open' }, categories: [{ id: 'category', name: '餐食', sort_order: 0, products: [product] }] };
}

test('cart review uses current SKU and option prices and treats reference stock as informational', () => {
  assert.deepEqual(reviewCart([line], menu()), [{ line, cents: 655, productName: '新商品名称', variantName: '新规格', options: ['新选项'] }]);
});

test('cart review identifies a discontinued option and a newly required choice without substituting defaults', () => {
  const current = menu();
  current.categories[0].products[0].selection_groups[0].group.options[0].is_active = false;
  assert.deepEqual(reviewCart([line], current), [{ line, issue: '所选选项已停售，请重新选择。', editableProductId: 'product' }]);
  const noSelection = { ...line, selections: [] };
  assert.deepEqual(reviewCart([noSelection], current), [{ line: noSelection, issue: '选项要求已更新，请重新选择。', editableProductId: 'product' }]);
});

test('cart review blocks discontinued variants and cross-store saved items', () => {
  const current = menu();
  current.categories[0].products[0].skus[0].is_active = false;
  const foreign = { ...line, storeId: 'other' };
  assert.deepEqual(reviewCart([line, foreign], current), [
    { line, issue: '商品或规格已停售。' }, { line: foreign, issue: '该商品属于其他门店。' },
  ]);
});

test('a saved product can be reselected when its original SKU is no longer on the menu', () => {
  const current = menu();
  const product = current.categories[0].products[0];
  product.skus = [{ ...product.skus[0], id: 'new-sku' }];
  const identified = { ...line, productId: 'product' };
  assert.deepEqual(reviewCart([identified], current), [
    { line: identified, issue: '原规格已停售，请重新选择。', editableProductId: 'product' },
  ]);
  product.status = 'SOLD_OUT';
  assert.deepEqual(reviewCart([identified], current), [{ line: identified, issue: '商品或规格已停售。' }]);
});
