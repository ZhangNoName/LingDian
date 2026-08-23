import { describe, expect, it } from "vitest";
import { resolveProductImage } from "./product-image";

describe("resolveProductImage", () => {
  it("keeps absolute and static asset URLs unchanged", () => {
    expect(resolveProductImage("https://cdn.example.com/burger.jpg", "Burgers")).toBe("https://cdn.example.com/burger.jpg");
    expect(resolveProductImage("/static/products/custom.jpg", "Drinks")).toBe("/static/products/custom.jpg");
  });

  it("prefixes relative backend asset URLs", () => {
    expect(resolveProductImage("/uploads/burger.jpg", "Burgers", "http://localhost:9000")).toBe(
      "http://localhost:9000/uploads/burger.jpg",
    );
  });

  it("treats reserved example-domain image URLs as unavailable demo data", () => {
    expect(resolveProductImage("https://example.com/demo/burger.jpg", "Burgers")).toBe(
      "/static/products/milk-green.jpg",
    );
  });

  it.each([
    ["Burgers", "/static/products/milk-green.jpg"],
    ["小食炸鸡", "/static/products/grapefruit.jpg"],
    ["Drinks", "/static/products/lime.jpg"],
    ["经典套餐", "/static/products/pearl-green.jpg"],
  ])("uses a category-specific local fallback for %s", (categoryName, expected) => {
    expect(resolveProductImage(undefined, categoryName)).toBe(expected);
  });
});
