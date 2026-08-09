import { afterEach, assert, expect, test, vi } from "vitest";
import { addCartItem, clearCart, getCartSummary } from "./cart";
import { createOrderFromCart } from "./orders";

const directCart = {
  itemCount: 1,
  totalAmount: 18,
  discountAmount: 0,
  items: [{
    id: "cart-1", productId: "product-1", skuId: "sku-1", productName: "拿铁", imageUrl: "/latte.png",
    quantity: 1, unitPrice: 18, selectedOptions: [],
  }],
};

afterEach(() => {
  clearCart();
  vi.restoreAllMocks();
});

test("delivery order request sends takeout type and the selected address id", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    if (String(options.url).endsWith("/menu/current")) {
      options.success?.({
        statusCode: 200,
        data: { code: 0, data: { store: { id: "store-1", name: "零点店", code: "demo", status: "open", businessHours: "09:00-21:00" }, categories: [] } },
      } as unknown as UniApp.RequestSuccessCallbackResult);
    } else {
      options.success?.({ statusCode: 201, data: { code: 0, data: { id: "order-1" } } } as unknown as UniApp.RequestSuccessCallbackResult);
    }
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await createOrderFromCart(directCart, { serviceMode: "delivery", addressId: "address-1" });

  const orderCall = request.mock.calls.find((call) => String(call[0].url).endsWith("/order/create"));
  assert.deepEqual(orderCall?.[0].data, {
    storeId: "store-1",
    orderType: "takeout",
    addressId: "address-1",
    paymentChannel: "cash",
    items: [{ sku_id: "sku-1", quantity: 1, selections: [] }],
  });
});

test("failed order submission keeps the real cart intact", async () => {
  addCartItem({
    id: "product-1", skuId: "sku-1", categoryId: "coffee", name: "拿铁", description: "", imageUrl: "/latte.png",
    price: 18, tags: [], hasSpec: false, comboImages: [], optionGroups: [],
  }, 1, []);
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.fail?.({ errMsg: "request:fail network" } as UniApp.GeneralCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await expect(createOrderFromCart(getCartSummary(), { serviceMode: "takeaway" })).rejects.toThrow();

  assert.equal(getCartSummary().itemCount, 1);
});
