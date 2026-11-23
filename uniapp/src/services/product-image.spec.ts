import { describe, expect, it } from "vitest";
import { resolveProductImage } from "./product-image";

describe("resolveProductImage", () => {
  it("keeps absolute and static asset URLs unchanged", () => {
    expect(resolveProductImage("https://cdn.example.com/burger.jpg")).toBe("https://cdn.example.com/burger.jpg");
    expect(resolveProductImage("/static/products/custom.jpg")).toBe("/static/products/custom.jpg");
  });

  it("prefixes relative backend asset URLs", () => {
    expect(resolveProductImage("/uploads/burger.jpg", "http://localhost:9000")).toBe(
      "http://localhost:9000/uploads/burger.jpg",
    );
  });

  it("treats reserved example-domain image URLs as unavailable demo data", () => {
    expect(resolveProductImage("https://example.com/demo/burger.jpg")).toBe("");
  });

  it("lets the shared placeholder represent a missing product image", () => {
    expect(resolveProductImage(undefined)).toBe("");
  });
});
