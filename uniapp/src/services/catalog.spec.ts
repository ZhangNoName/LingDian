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

test("maps store fulfilment flags instead of advertising unavailable modes", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({
      statusCode: 200,
      data: {
        code: 0,
        data: {
          ...menu,
          store: {
            ...menu.store,
            dineInEnabled: false,
            pickupEnabled: true,
            takeoutEnabled: true,
          },
        },
      },
    } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  const result = await fetchMenu();

  assert.deepEqual(result.store.supportModes, ["takeaway", "delivery"]);
});

test("exposes only product and selected-variant option groups", async () => {
  const product = menu.categories[0].products[0];
  const group = (id: string) => ({
    binding_id: `binding-${id}`,
    scope: "PRODUCT" as const,
    target_variant_id: null,
    sort_order: 0,
    is_enabled: true,
    group: {
      id,
      name: id,
      group_type: "MODIFIER" as const,
      selection_mode: "SINGLE" as const,
      min_select: 0,
      max_select: 1,
      is_required: false,
      is_active: true,
      sort_order: 0,
      description: null,
      options: [],
    },
  });
  const currentVariant = { ...group("current"), scope: "VARIANT" as const, target_variant_id: "sku-1" };
  const otherVariant = { ...group("other"), scope: "VARIANT" as const, target_variant_id: "sku-2" };
  const disabled = { ...group("disabled"), is_enabled: false };
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({
      statusCode: 200,
      data: {
        code: 0,
        data: {
          ...menu,
          categories: [{
            ...menu.categories[0],
            products: [{
              ...product,
              skus: [
                ...product.skus,
                { ...product.skus[0], id: "sku-2", is_default: false },
              ],
              selection_groups: [group("product"), currentVariant, otherVariant, disabled],
            }],
          }],
        },
      },
    } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  const result = await fetchMenu();

  assert.deepEqual(result.productDetails["product-1"].optionGroups.map((item) => item.id), ["product", "current"]);
});

test("does not let an older request overwrite a newer forced refresh", async () => {
  const successes: Array<NonNullable<UniApp.RequestOptions["success"]>> = [];
  const request = vi.fn((options: UniApp.RequestOptions) => {
    if (options.success) successes.push(options.success);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  const olderRequest = fetchMenu();
  const newerRequest = fetchMenu({ force: true });
  successes[1]({
    statusCode: 200,
    data: { code: 0, data: { ...menu, store: { ...menu.store, name: "新菜单" } } },
  } as unknown as UniApp.RequestSuccessCallbackResult);
  assert.equal((await newerRequest).store.name, "新菜单");

  successes[0]({
    statusCode: 200,
    data: { code: 0, data: { ...menu, store: { ...menu.store, name: "旧菜单" } } },
  } as unknown as UniApp.RequestSuccessCallbackResult);
  assert.equal((await olderRequest).store.name, "旧菜单");

  assert.equal((await fetchMenu()).store.name, "新菜单");
  assert.equal(request.mock.calls.length, 2);
});
