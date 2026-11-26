import { afterEach, describe, expect, it, vi } from "vitest";
import { customerAuth, loginWithProvider } from "./auth";
import { subscribeToPickup } from "./pickup-notification";
import { request } from "./request";

vi.mock("./auth", () => ({
  customerAuth: { getSessionVersion: vi.fn(() => 1) },
  loginWithProvider: vi.fn().mockResolvedValue("fresh-login"),
}));
vi.mock("./request", () => ({
  request: vi.fn().mockResolvedValue({ template_id: "pickup-template", subscribed: true }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("WeChat pickup reminders", () => {
  it("records consent for this order only after the user accepts the template", async () => {
    vi.stubGlobal("uni", {
      requestSubscribeMessage: ({ tmplIds, success }: {
        tmplIds: string[]; success: (body: Record<string, string>) => void;
      }) => {
        expect(tmplIds).toEqual(["pickup-template"]);
        success({ "pickup-template": "accept" });
      },
    });
    await expect(subscribeToPickup("order/a", "pickup-template")).resolves.toMatchObject({ subscribed: true });
    expect(loginWithProvider).toHaveBeenCalledWith("WECHAT");
    expect(request).toHaveBeenCalledWith("/customer/orders/order%2Fa/pickup-notification", {
      method: "POST", data: { templateId: "pickup-template", loginCode: "fresh-login" },
    });
  });

  it("does not register a declined subscription or one from a previous session", async () => {
    vi.stubGlobal("uni", {
      requestSubscribeMessage: ({ success }: { success: (body: Record<string, string>) => void }) =>
        success({ "pickup-template": "reject" }),
    });
    await expect(subscribeToPickup("order", "pickup-template")).resolves.toBeNull();
    expect(loginWithProvider).not.toHaveBeenCalled();
    vi.mocked(customerAuth.getSessionVersion).mockReturnValueOnce(1).mockReturnValueOnce(2);
    vi.stubGlobal("uni", {
      requestSubscribeMessage: ({ success }: { success: (body: Record<string, string>) => void }) =>
        success({ "pickup-template": "accept" }),
    });
    await expect(subscribeToPickup("order", "pickup-template")).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});
