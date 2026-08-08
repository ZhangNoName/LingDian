import { describe, expect, it } from "vitest";
import { resolveMenuViewState } from "./menu-view-state";

describe("resolveMenuViewState", () => {
  it("prioritizes loading over failure and content", () => {
    expect(
      resolveMenuViewState({ loading: true, failed: true, sectionCount: 2 }),
    ).toBe("loading");
  });

  it("returns error when loading is complete and the menu failed", () => {
    expect(
      resolveMenuViewState({ loading: false, failed: true, sectionCount: 2 }),
    ).toBe("error");
  });

  it("returns empty when the menu has no sections", () => {
    expect(
      resolveMenuViewState({ loading: false, failed: false, sectionCount: 0 }),
    ).toBe("empty");
  });

  it("returns ready when the menu contains sections", () => {
    expect(
      resolveMenuViewState({ loading: false, failed: false, sectionCount: 1 }),
    ).toBe("ready");
  });
});
