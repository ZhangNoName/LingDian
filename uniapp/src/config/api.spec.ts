import { describe, expect, it } from "vitest";
import { buildApiUrl, buildAssetUrl, normalizeApiBase } from "./api";

describe("client API runtime configuration", () => {
  it("normalizes a configured gateway exactly once", () => {
    expect(normalizeApiBase(" https://api.example.com/api/ ")).toBe("https://api.example.com/api");
    expect(buildApiUrl("/orders")).toMatch(/\/api\/orders$/);
  });

  it("uses the same-origin gateway when an H5 production build has no override", () => {
    expect(normalizeApiBase(undefined, true)).toBe("/api");
    expect(() => normalizeApiBase("http://api.example.com/api", true)).toThrow(/HTTPS/);
  });

  it("rejects absolute, protocol-relative, and malformed service paths", () => {
    expect(() => buildApiUrl("orders")).toThrow(/path/i);
    expect(() => buildApiUrl("//attacker.example/orders")).toThrow(/path/i);
  });

  it("keeps local assets and joins backend assets safely", () => {
    expect(buildAssetUrl("/static/products/demo.jpg")).toBe("/static/products/demo.jpg");
    expect(buildAssetUrl("/uploads/demo.webp")).toMatch(/\/uploads\/demo\.webp$/);
  });
});
