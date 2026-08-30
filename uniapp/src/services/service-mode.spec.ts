import { describe, expect, it } from "vitest";
import { buildServiceModeUrl, parseServiceMode } from "./service-mode";

describe("service mode route context", () => {
  it("accepts only supported service-mode values", () => {
    expect(parseServiceMode("dineIn")).toBe("dineIn");
    expect(parseServiceMode("delivery")).toBe("delivery");
    expect(parseServiceMode("other")).toBeUndefined();
  });

  it("carries the selected mode through product routes", () => {
    expect(buildServiceModeUrl("/pages/spec/spec", "delivery", { id: "product/1" }))
      .toBe("/pages/spec/spec?id=product%2F1&mode=delivery");
  });
});
