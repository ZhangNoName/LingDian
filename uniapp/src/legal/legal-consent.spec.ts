import { describe, expect, it } from "vitest";
import {
  LegalConsentRequiredError,
  createLoginLegalConsentActions,
  requireLegalConsent,
} from "./legal-consent";

describe("requireLegalConsent", () => {
  it("rejects an unchecked login", () => {
    expect(() => requireLegalConsent(false)).toThrow(LegalConsentRequiredError);
  });

  it("returns both current versions after explicit consent", () => {
    expect(requireLegalConsent(true)).toEqual({
      userAgreementVersion: "2026-08-17",
      privacyPolicyVersion: "2026-08-17",
    });
  });
});

describe("login action consent guard", () => {
  it.each([
    ["sendCode", "send code"],
    ["submit", "submit phone login"],
    ["beginThirdPartyLogin", "start third-party authorization"],
    ["wechatPhoneLogin", "handle WeChat phone login"],
  ] as const)("blocks %s before its auth action when unchecked", async (actionName) => {
    const messages: string[] = [];
    let authActionCount = 0;
    const actions = createLoginLegalConsentActions(
      () => false,
      (message) => messages.push(message),
    );

    await actions[actionName](async () => {
      authActionCount += 1;
    });

    expect(authActionCount).toBe(0);
    expect(messages).toEqual(["请先阅读并同意《用户服务协议》和《隐私政策》"]);
  });

  it("executes an accepted action with both current versions", async () => {
    const messages: string[] = [];
    const actions = createLoginLegalConsentActions(
      () => true,
      (message) => messages.push(message),
    );

    const received = await actions.submit(async (legalConsent) => legalConsent);

    expect(received).toEqual({
      userAgreementVersion: "2026-08-17",
      privacyPolicyVersion: "2026-08-17",
    });
    expect(messages).toEqual([]);
  });
});
