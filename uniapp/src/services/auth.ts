import type { AuthTokens, AuthenticatedUser, LegalConsentInput, PendingOAuthResponse } from "@lingdian/contracts";
import { ApiError, NetworkError, requestApiEnvelope } from "@/infra/http/uni-http-client";
import { miniProgramAuthProvider, usesBrowserCookieTransport } from "@/config/platform";
import { getCustomerAuthMessage } from "./auth-message";
const DEMO_TOKEN_KEY = "lingdian_demo_token";
const DEVICE_STORAGE_KEY = "lingdian_customer_device_id";
const AUTO_RECOVERY_BLOCKED_KEY = "lingdian_customer_auto_recovery_blocked";

export type ThirdPartyProvider = "WECHAT" | "QQ";

type SendCodePurpose = "PHONE_LOGIN" | "PHONE_LINK";
let accessToken: string | undefined;
let accessTokenExpiresAt = 0;
let currentUser: AuthenticatedUser | undefined;
let refreshPromise: Promise<boolean> | undefined;

const supportedThirdPartyProviders: ThirdPartyProvider[] = [];

// #ifdef MP-WEIXIN
supportedThirdPartyProviders.push("WECHAT");
// #endif

// #ifdef MP-QQ
supportedThirdPartyProviders.push("QQ");
// #endif

function forgetDemoToken(): void {
  uni.removeStorageSync(DEMO_TOKEN_KEY);
}

function readErrorMessage(body: { code?: number; msg?: string } | undefined): string {
  return getCustomerAuthMessage({
    code: body?.code,
    message: body?.msg || "Authentication request failed.",
  });
}

function authRequest<T>(path: string, options: Omit<UniApp.RequestOptions, "url"> = {}): Promise<T> {
  const { header, method, ...requestOptions } = options;
  return requestApiEnvelope<T>({
    ...requestOptions,
    path,
    method: method as UniApp.RequestOptions["method"],
    header: {
      "X-Device-Id": deviceId(),
      ...(header as Record<string, string> | undefined),
    },
  }).catch((error: unknown) => {
    if (error instanceof ApiError) {
      throw new Error(readErrorMessage({ code: error.code, msg: error.message }));
    }
    if (error instanceof NetworkError) {
      throw new Error(getCustomerAuthMessage(new Error(error.causeMessage || error.message)));
    }
    throw error;
  });
}

function loginWithProvider(provider: ThirdPartyProvider): Promise<string> {
  const platformProvider = provider === "WECHAT" ? "weixin" : "qq";

  return new Promise((resolve, reject) => {
    uni.login({
      provider: platformProvider,
      success(result) {
        if (result.code) {
          resolve(result.code);
          return;
        }
        reject(new Error("Third-party authorization did not return a code."));
      },
      fail(error) {
        reject(new Error(error.errMsg || "Third-party authorization failed."));
      },
    });
  });
}

export async function beginMiniProgramThirdPartyLogin(provider: ThirdPartyProvider): Promise<PendingOAuthResponse> {
  const code = await loginWithProvider(provider);
  return authRequest<PendingOAuthResponse>(`/auth/oauth/${provider.toLowerCase()}/miniapp/callback`, {
    method: "POST",
    data: { code, audience: "user-api" },
  });
}

export const customerAuth = {
  acceptLogin(tokens: AuthTokens): void {
    if (tokens.user.audience !== "user-api" || !tokens.user.roles.includes("USER")) {
      this.clear();
      throw new Error("登录响应不属于顾客端，已拒绝建立会话。");
    }
    forgetDemoToken();
    uni.removeStorageSync(AUTO_RECOVERY_BLOCKED_KEY);
    accessToken = tokens.access_token;
    accessTokenExpiresAt = Date.now() + tokens.expires_in * 1000;
    currentUser = tokens.user;
  },

  getAccessToken(): string | undefined {
    if (!accessToken || Date.now() >= accessTokenExpiresAt) return undefined;
    return accessToken;
  },

  getUser(): AuthenticatedUser | undefined {
    return currentUser;
  },

  isSignedIn(): boolean {
    return Boolean(this.getAccessToken());
  },

  clear(): void {
    forgetDemoToken();
    accessToken = undefined;
    accessTokenExpiresAt = 0;
    currentUser = undefined;
  },

  blockAutomaticRecovery(): void {
    this.clear();
    uni.setStorageSync(AUTO_RECOVERY_BLOCKED_KEY, true);
  },

  async sendCode(phone: string, purpose: SendCodePurpose = "PHONE_LOGIN"): Promise<void> {
    await authRequest("/auth/codes", {
      method: "POST",
      data: { phone, purpose, deviceId: deviceId() },
    });
  },

  async phoneLogin(phone: string, code: string, legalConsent: LegalConsentInput): Promise<void> {
    const tokens = await authRequest<AuthTokens>("/auth/phone/login", {
      method: "POST",
      data: { phone, code, audience: "user-api", legalConsent },
    });
    this.acceptLogin(tokens);
  },

  async beginThirdPartyLogin(provider: ThirdPartyProvider): Promise<PendingOAuthResponse> {
    if (!supportedThirdPartyProviders.includes(provider)) {
      throw new Error("This platform does not support the selected sign-in provider.");
    }

    return beginMiniProgramThirdPartyLogin(provider);
  },

  async wechatPhoneLogin(phoneCode: string, legalConsent: LegalConsentInput): Promise<void> {
    const loginCode = await loginWithProvider("WECHAT");
    const tokens = await authRequest<AuthTokens>("/auth/wechat/miniapp/phone-login", {
      method: "POST",
      data: { loginCode, phoneCode, audience: "user-api", legalConsent },
    });
    this.acceptLogin(tokens);
  },

  async completePhoneLink(
    pendingOauthId: string,
    phone: string,
    code: string,
    legalConsent: LegalConsentInput,
  ): Promise<void> {
    const tokens = await authRequest<AuthTokens>("/auth/oauth/link-phone", {
      method: "POST",
      data: { pendingOauthId, phone, code, legalConsent },
    });
    this.acceptLogin(tokens);
  },

  async refresh(): Promise<boolean> {
    if (uni.getStorageSync(AUTO_RECOVERY_BLOCKED_KEY) === true) return false;
    if (refreshPromise) return refreshPromise;
    refreshPromise = refreshCustomerSession().finally(() => {
      refreshPromise = undefined;
    });
    return refreshPromise;
  },

  async logout(): Promise<void> {
    const hadLocalSession = Boolean(accessToken || currentUser);
    let token = this.getAccessToken();
    try {
      if (!token && hadLocalSession && await this.refresh()) token = this.getAccessToken();
      if (token) {
        await authRequest<void>("/auth/logout", {
          method: "POST",
          header: { Authorization: `Bearer ${token}` },
        });
      }
    } finally {
      this.blockAutomaticRecovery();
    }
  },

  async recoverAfterRelaunch(): Promise<boolean> {
    accessToken = undefined;
    accessTokenExpiresAt = 0;
    currentUser = undefined;
    return this.refresh();
  },

  getSupportedThirdPartyProviders(): readonly ThirdPartyProvider[] {
    return supportedThirdPartyProviders;
  },
};

async function refreshCustomerSession(): Promise<boolean> {
  try {
    let tokens: AuthTokens;
    if (usesBrowserCookieTransport()) {
      tokens = await authRequest<AuthTokens>("/auth/refresh", { method: "POST", data: {} });
    } else {
      const provider = miniProgramAuthProvider();
      if (!provider) {
        customerAuth.clear();
        return false;
      }
      const code = await loginWithProvider(provider);
      tokens = await authRequest<AuthTokens>(`/auth/oauth/${provider.toLowerCase()}/miniapp/session`, {
        method: "POST",
        data: { code, audience: "user-api" },
      });
    }
    customerAuth.acceptLogin(tokens);
    return true;
  } catch {
      customerAuth.clear();
      return false;
  }
}

function deviceId(): string {
  const existing = uni.getStorageSync(DEVICE_STORAGE_KEY);
  if (typeof existing === "string" && existing) return existing;
  const created = `customer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  uni.setStorageSync(DEVICE_STORAGE_KEY, created);
  return created;
}

forgetDemoToken();
