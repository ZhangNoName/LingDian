import { afterEach, assert, test, vi } from "vitest";
import { fetchMenu, invalidateMenuCache } from "./catalog";

const menu = {
  store: { id: "store-1", name: "零点店", status: "open", businessHours: "09:00-21:00" },
  categories: [{
    id: "category-1",
    name: "饮品",
    sort_order: 0,
    products: [{
      id: "product-1", store_id: "store-1", category_id: "category-1", category: "饮品",
      name: "拿铁", description: "热饮", image_url: null, type: "SINGLE", price: 18, stock: 10,
      status: "ACTIVE", is_active: true, is_featured: false,
      skus: [{ id: "sku-1", product_id: "product-1", sku_name: "默认", price: 18, stock_count: 10, is_default: true, is_active: true }],
      selection_groups: [],
    }],
  }],
};

afterEach(() => {
  invalidateMenuCache();
  vi.restoreAllMocks();
});

test("coalesces concurrent menu requests and reuses the fresh menu cache", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 200, data: { code: 0, data: menu } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  const [first, second] = await Promise.all([fetchMenu(), fetchMenu()]);
  const third = await fetchMenu();

  assert.equal(request.mock.calls.length, 1);
  assert.equal(first, second);
  assert.equal(second, third);
  assert.equal(first.products[0].name, "拿铁");
});

test("force refresh bypasses a fresh menu cache", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 200, data: { code: 0, data: menu } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await fetchMenu();
  await fetchMenu({ force: true });

  assert.equal(request.mock.calls.length, 2);
});
