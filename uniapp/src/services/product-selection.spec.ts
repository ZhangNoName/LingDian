import { describe, expect, it } from "vitest";
import type { OptionGroup } from "@/types/menu";
import {
  initializeProductSelections,
  toggleProductSelection,
  validateProductSelections,
} from "./product-selection";

function group(overrides: Partial<OptionGroup> = {}): OptionGroup {
  return {
    id: "group-1",
    name: "加料",
    required: false,
    selectionMode: "SINGLE",
    min: 0,
    max: 1,
    options: [
      { id: "option-1", name: "珍珠", isDefault: false },
      { id: "option-2", name: "椰果", isDefault: false },
    ],
    ...overrides,
  };
}

describe("product selections", () => {
  it("does not silently add an optional paid option", () => {
    expect(initializeProductSelections([group()])).toEqual({ "group-1": [] });
  });

  it("uses configured defaults and fills a required minimum", () => {
    const required = group({
      required: true,
      selectionMode: "MULTIPLE",
      min: 2,
      max: 2,
      options: [
        { id: "option-1", name: "珍珠", isDefault: false },
        { id: "option-2", name: "椰果", isDefault: true },
      ],
    });

    expect(initializeProductSelections([required])).toEqual({
      "group-1": ["option-2", "option-1"],
    });
  });

  it("supports distinct multiple selections and enforces the maximum", () => {
    const multiple = group({ selectionMode: "MULTIPLE", max: 1 });
    const first = toggleProductSelection(multiple, [], "option-1");
    const second = toggleProductSelection(multiple, first.selected, "option-2");

    expect(first).toEqual({ selected: ["option-1"], limitReached: false });
    expect(second).toEqual({ selected: ["option-1"], limitReached: true });
  });

  it("reports missing required choices", () => {
    const required = group({ required: true });
    expect(validateProductSelections([required], { "group-1": [] })).toMatch(/至少选择 1 项/);
  });
});
