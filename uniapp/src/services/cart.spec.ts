import { afterEach, expect, test } from "vitest";
import type { ProductDetail, SelectedOption } from "@/types/menu";
import { addCartItem, clearCart, getCartSummary } from "./cart";

const product: ProductDetail = {
  id: "product-1",
  categoryId: "category-1",
  skuId: "sku-1",
  name: "套餐",
  imageUrl: "/combo.png",
  price: 18.1,
  tags: [],
  hasSpec: true,
  optionGroups: [],
  comboImages: [],
};

const options: SelectedOption[] = [
  { groupId: "drink", optionId: "tea", name: "茶", priceDelta: 0.1 },
  { groupId: "snack", optionId: "chips", name: "薯条", priceDelta: 0.2 },
];

afterEach(() => clearCart());

test("merges the same option set regardless of selection order", () => {
  addCartItem(product, 1, options);
  const result = addCartItem(product, 2, [...options].reverse());

  expect(result.itemCount).toBe(3);
  expect(result.items).toHaveLength(1);
  expect(result.totalAmount).toBe(55.2);
});

test("does not expose mutable cart state to callers", () => {
  addCartItem(product, 1, options);
  const snapshot = getCartSummary();
  snapshot.items[0].quantity = 99;
  snapshot.items[0].selectedOptions[0].name = "篡改";
  snapshot.items.splice(0);

  const current = getCartSummary();
  expect(current.itemCount).toBe(1);
  expect(current.items[0].selectedOptions[0].name).toBe("茶");
});

test.each([0, -1, 1.5, Number.NaN])("rejects an invalid quantity: %s", (quantity) => {
  expect(() => addCartItem(product, quantity, options)).toThrow(/数量/);
});
