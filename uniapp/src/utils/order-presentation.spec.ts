import { describe, expect, it } from "vitest";
import { formatOrderSource, resolvePickupCode } from "./order-presentation";

describe("order presentation", () => {
  it.each([
    ["MINIAPP", "小程序"],
    ["MEITUAN_WAIMAI", "美团外卖"],
    ["JD_DAOJIA", "京东到家"],
    ["POS", "收银台"],
    ["MANUAL", "人工录单"],
  ] as const)("maps the %s order source", (source, expected) => {
    expect(formatOrderSource(source)).toBe(expected);
  });

  it("keeps unknown future sources visible", () => {
    expect(formatOrderSource("PARTNER_API")).toBe("PARTNER_API");
  });

  it("marks orders without a recorded source as historical", () => {
    expect(formatOrderSource(null)).toBe("历史订单");
    expect(formatOrderSource(undefined)).toBe("历史订单");
  });

  it("uses the channel pickup code and preserves its leading zeroes", () => {
    expect(resolvePickupCode("LD202608290001", " U-007 ")).toBe("U-007");
  });

  it("falls back to the complete order number for historical orders", () => {
    expect(resolvePickupCode("LD202608290001", null)).toBe("LD202608290001");
    expect(resolvePickupCode("LD202608290001", "   ")).toBe("LD202608290001");
  });
});
