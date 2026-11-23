import { afterEach, assert, expect, test, vi } from "vitest";
import { addCartItem, clearCart, getCartSummary } from "./cart";
import { createOrderFromCart, fetchOrderDetail, fetchOrders, MAX_ORDER_REMARK_LENGTH } from "./orders";

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

  await createOrderFromCart(directCart, {
    serviceMode: "delivery",
    addressId: "address-1",
    clientRequestId: "checkout-request-1",
    remark: "   ",
  });

  const orderCall = request.mock.calls.find((call) => String(call[0].url).endsWith("/order/create"));
  assert.deepEqual(orderCall?.[0].data, {
    clientRequestId: "checkout-request-1",
    storeId: "store-1",
    orderType: "takeout",
    addressId: "address-1",
    paymentChannel: "cash",
    items: [{ sku_id: "sku-1", quantity: 1, selections: [] }],
  });
});

test("rejects a delivery order without an address before making a request", async () => {
  const request = vi.fn();
  Object.assign(uni, { request });

  await expect(createOrderFromCart(directCart, { serviceMode: "delivery" }))
    .rejects.toThrow("配送订单必须选择收货地址");
  expect(request).not.toHaveBeenCalled();
});

test("dine-in order request sends the order type and a trimmed remark", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    if (String(options.url).endsWith("/menu/current")) {
      options.success?.({
        statusCode: 200,
        data: { code: 0, data: { store: { id: "store-1", name: "零点店", code: "demo", status: "open", businessHours: "09:00-21:00" }, categories: [] } },
      } as unknown as UniApp.RequestSuccessCallbackResult);
    } else {
      options.success?.({ statusCode: 201, data: { code: 0, data: { id: "order-dine-in" } } } as unknown as UniApp.RequestSuccessCallbackResult);
    }
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await createOrderFromCart(directCart, {
    serviceMode: "dineIn",
    clientRequestId: "checkout-dine-in-1",
    remark: "  少放辣椒\n不要餐具  ",
  });

  const orderCall = request.mock.calls.find((call) => String(call[0].url).endsWith("/order/create"));
  expect(orderCall?.[0].data).toMatchObject({
    clientRequestId: "checkout-dine-in-1",
    orderType: "dine_in",
    remark: "少放辣椒\n不要餐具",
  });
});

test("rejects an order remark that exceeds the storage limit", async () => {
  const request = vi.fn();
  Object.assign(uni, { request });

  await expect(createOrderFromCart(directCart, {
    serviceMode: "takeaway",
    remark: "字".repeat(MAX_ORDER_REMARK_LENGTH + 1),
  })).rejects.toThrow(`订单备注最多 ${MAX_ORDER_REMARK_LENGTH} 字`);
  expect(request).not.toHaveBeenCalled();
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

test("a retry after a lost response reuses the order key and preserves later cart additions", async () => {
  const product = { id: "product-1", skuId: "sku-1", categoryId: "coffee", name: "拿铁", description: "",
    imageUrl: "", price: 18, tags: [], hasSpec: false, comboImages: [], optionGroups: [] };
  const cart = addCartItem(product, 1, []);
  const keys: string[] = [];
  let finish!: NonNullable<UniApp.RequestOptions["success"]>;
  const send = vi.fn((options: UniApp.RequestOptions) => {
    if (String(options.url).endsWith("/menu/current")) {
      options.success?.({ statusCode: 200, data: { code: 0, data: { store: { id: "store-1", status: "open" }, categories: [] } } } as unknown as UniApp.RequestSuccessCallbackResult);
    } else {
      keys.push((options.data as { clientRequestId: string }).clientRequestId);
      if (keys.length === 1) options.fail?.({ errMsg: "timeout" });
      else finish = options.success!;
    }
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request: send });
  await expect(createOrderFromCart(cart)).rejects.toThrow();
  const retries = Promise.all([createOrderFromCart(cart), createOrderFromCart(cart)]);
  await vi.waitFor(() => expect(finish).toBeDefined());
  addCartItem(product, 2, []);
  finish({ statusCode: 201, data: { code: 0, data: { id: "o" } } } as unknown as UniApp.RequestSuccessCallbackResult);
  await retries;
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  expect(getCartSummary().itemCount).toBe(2);
});

test("a restarted mini program reconciles the original receipt after the cart changes", async () => {
  const profile = { userId: "restarted", sessionId: "s", audience: "user-api", roles: ["USER"] } as const;
  let acceptedKey: string | undefined;
  let lost = true;
  Object.assign(uni, { request(options: UniApp.RequestOptions) {
    const ok = (data: unknown) => options.success?.({ statusCode: 200, data: { code: 0, data } } as unknown as UniApp.RequestSuccessCallbackResult);
    if (String(options.url).endsWith("/menu/current")) return ok({ store: { id: "s", status: "OPEN" }, categories: [] });
    const key = (options.data as { clientRequestId: string }).clientRequestId;
    if (lost) {
      lost = false;
      acceptedKey = key;
      options.fail?.({ errMsg: "request:fail timeout" });
    } else {
      expect(key).toBe(acceptedKey);
      ok({ id: "original", items: [{ product_id: "a", sku_id: "sku-a", quantity: 1, selections: [] }] });
    }
  } });
  const login = async () => {
    const { customerAuth } = await import("./auth");
    customerAuth.acceptLogin({ access_token: "session", expires_in: 900, user: { ...profile, roles: ["USER"] } });
  };
  const product = { id: "a", skuId: "sku-a", name: "餐品", price: 10, categoryId: "c", description: "", imageUrl: "", tags: [], hasSpec: false, comboImages: [], optionGroups: [] };
  vi.spyOn(uni, "getSystemInfoSync").mockReturnValue({ uniPlatform: "mp-weixin" } as ReturnType<typeof uni.getSystemInfoSync>);
  (await import("./catalog")).invalidateMenuCache();
  const originalAuth = (await import("./auth")).customerAuth;
  await login();
  await expect(createOrderFromCart(addCartItem(product, 1, []))).rejects.toThrow();
  vi.resetModules();
  await login();
  const cart = await import("./cart");
  const restarted = await import("./orders");
  cart.addCartItem(product, 2, []);
  cart.addCartItem({ ...product, id: "b", skuId: "sku-b" }, 1, []);
  expect((await restarted.createOrderFromCart(cart.getCartSummary())).id).toBe("original");
  expect(cart.getCartSummary().items.map(item => item.quantity)).toEqual([1, 1]);
  cart.clearCart();
  originalAuth.clear();
  (await import("./auth")).customerAuth.clear();
});

test("order history sends pagination parameters and maps the page contract", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({
      statusCode: 200,
      data: {
        code: 0,
        data: {
          items: [{
            id: "order-21", order_no: "LD21", store_id: "store-1", store_name: "零点店",
            order_source: "MEITUAN_WAIMAI", pickup_code: "MT-00021", pickup_business_date: "2026-08-23",
            customer_name: "顾客", customer_mobile: "13800000000", delivery_address: null,
            order_type: "PICKUP", status: "PAID", payment_channel: "CASH", total_amount: 18,
            payable_amount: 18, remark: null, item_count: 2, item_summary: [],
            created_at: "2026-08-23T00:00:00.000Z", updated_at: "2026-08-23T00:00:00.000Z",
          }],
          total: 41,
          page: 2,
          page_size: 20,
        },
      },
    } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  const result = await fetchOrders(2, 20);

  assert.match(String(request.mock.calls[0][0].url), /customer\/orders\?page=2&pageSize=20$/);
  assert.deepEqual({ total: result.total, page: result.page, pageSize: result.pageSize }, { total: 41, page: 2, pageSize: 20 });
  assert.equal(result.items[0].itemCount, 2);
  assert.equal(result.items[0].orderNo, "LD21");
  assert.equal(result.items[0].orderSource, "MEITUAN_WAIMAI");
  assert.equal(result.items[0].pickupCode, "MT-00021");
  assert.equal(result.items[0].pickupBusinessDate, "2026-08-23");
  assert.deepEqual(result.items[0].productThumbs, []);
});

test("preserves dine-in orders instead of presenting them as takeaway", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({
      statusCode: 200,
      data: {
        code: 0,
        data: {
          items: [{
            id: "order-dine-in", order_no: "LD-DINE-IN", store_name: "零点店",
            order_source: "MINIAPP", pickup_code: "A-001", pickup_business_date: "2026-08-23",
            customer_name: "顾客", customer_mobile: "13800000000", delivery_address: null,
            order_type: "DINE_IN", status: "PAID", payment_channel: "CASH", total_amount: 18,
            payable_amount: 18, remark: null, item_count: 1, item_summary: [],
            created_at: "2026-08-23T00:00:00.000Z",
          }],
          total: 1, page: 1, page_size: 20,
        },
      },
    } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  const result = await fetchOrders();

  assert.equal(result.items[0].serviceMode, "dineIn");
});

test("order detail shows its source and falls back to the complete order number for historical pickup codes", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({
      statusCode: 200,
      data: {
        code: 0,
        data: {
          id: "order-old",
          order_no: "LD20260823000021",
          order_source: "JD_DAOJIA",
          pickup_code: null,
          pickup_business_date: "2026-08-23",
          store_name: "零点店",
          customer_name: "顾客",
          customer_mobile: "13800000000",
          delivery_address: null,
          order_type: "PICKUP",
          status: "PAID",
          payable_amount: 18,
          payment_channel: "WECHAT",
          remark: "少放辣椒\n不要餐具",
          created_at: "2026-08-23T00:00:00.000Z",
          paid_at: "2026-08-23T00:01:00.000Z",
          status_logs: [{
            id: "log-ready", from_status: "PREPARING", to_status: "READY",
            operator_name: null, note: null, created_at: "2026-08-23T00:10:00.000Z",
          }],
          items: [{
            id: "item", product_name: "拿铁", quantity: 2, unit_price: 8, subtotal: 18.06,
            selections: [{ option_name: "加料", quantity: 1, price_delta: 1.03 }],
          }],
        },
      },
    } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  const result = await fetchOrderDetail("order-old/with?query");
  const rows = new Map(result.infoRows.map((row) => [row.label, row.value]));

  assert.equal(result.items[0].subtotal, 18.06);
  assert.equal(result.goodsAmount, 18.06);
  assert.equal(result.orderNo, "LD20260823000021");
  assert.equal(result.pickupCode, "LD20260823000021");
  assert.equal(result.pickupCardCode, undefined);
  assert.equal(rows.get("订单来源"), "京东到家");
  assert.equal(rows.get("取餐日期"), "2026-08-23");
  assert.equal(rows.get("取餐码"), "LD20260823000021");
  assert.equal(rows.get("订单编号"), "LD20260823000021");
  assert.equal(rows.get("支付方式"), "微信支付");
  assert.equal(rows.get("备注"), "少放辣椒\n不要餐具");
  assert.equal(rows.has("预计取餐时间"), false);
  assert.match(rows.get("出餐时间") ?? "", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.deepEqual(result.productThumbs, []);
  assert.match(String(request.mock.calls[0][0].url), /customer\/orders\/order-old%2Fwith%3Fquery$/);
});

test("unknown backend statuses stay unknown instead of being presented as unpaid", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({
      statusCode: 200,
      data: {
        code: 0,
        data: {
          items: [{
            id: "order-new-status", order_no: "LD-NEW", store_name: "零点店",
            order_source: "MINIAPP", pickup_code: null, pickup_business_date: null,
            customer_name: "顾客", customer_mobile: "13800000000", delivery_address: null,
            order_type: "PICKUP", status: "AWAITING_CONFIRMATION", payment_channel: "CASH",
            payable_amount: 18, remark: null, item_count: 1, item_summary: [],
            created_at: "2026-08-23T00:00:00.000Z",
          }],
          total: 1, page: 1, page_size: 20,
        },
      },
    } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  const result = await fetchOrders();

  assert.equal(result.items[0].status, "unknown");
});

test.each([
  { orderType: "PICKUP", status: "PREPARING", paymentRequired: false, label: "取餐码", highlighted: true },
  { orderType: "DINE_IN", status: "READY", paymentRequired: true, label: "取餐码", highlighted: true },
  { orderType: "PICKUP", status: "COMPLETED", paymentRequired: false, label: "取餐码", highlighted: true },
  { orderType: "PICKUP", status: "PENDING_PAYMENT", paymentRequired: true, label: "取餐码", highlighted: true },
  { orderType: "TAKEOUT", status: "PENDING_PAYMENT", paymentRequired: true, label: "订单码", highlighted: true },
  { orderType: "TAKEOUT", status: "READY", paymentRequired: false, label: "订单码", highlighted: true },
  { orderType: "TAKEOUT", status: "CANCELLED", paymentRequired: true, label: "订单码", highlighted: false },
])("shows the order code consistently for $orderType $status", async ({ orderType, status, paymentRequired, label, highlighted }) => {
  const record = {
    id: "order-1", order_no: "LD12345678", store_name: "零点店",
    order_type: orderType, status, payment_required: paymentRequired, pickup_code: "U-0032",
    pickup_business_date: "2026-11-20", payment_channel: "CASH",
    payable_amount: 15, total_amount: 15, created_at: "2026-11-20T00:00:00.000Z",
  };
  Object.assign(uni, { request: (options: UniApp.RequestOptions) => {
    const isList = new URL(options.url).pathname.endsWith("/customer/orders");
    const data = isList ? { items: [record], total: 1, page: 1, page_size: 20 } : record;
    options.success?.({ statusCode: 200, data: { code: 0, data } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  } });

  const order = await fetchOrderDetail(record.id);
  const { items } = await fetchOrders();
  const displayedCode = highlighted ? record.pickup_code : undefined;
  assert.equal(order.pickupCardCode, displayedCode);
  assert.equal(order.pickupCodeLabel, label);
  assert.equal(items[0].pickupCardCode, displayedCode);
  assert.equal(items[0].pickupCodeLabel, label);
  assert.equal(order.infoRows.some(row => row.label === label), !highlighted);
  assert.equal(order.infoRows.some(row => row.label === "取餐日期"), orderType !== "TAKEOUT");
});
