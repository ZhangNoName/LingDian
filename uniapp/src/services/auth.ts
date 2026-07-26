import type { AuthTokens, AuthenticatedUser, PendingOAuthResponse } from "@lingdian/contracts";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "http://localhost:9000/api";
}
const DEMO_TOKEN_KEY = "lingdian_demo_token";

export type ThirdPartyProvider = "WECHAT" | "QQ";

type SendCodePurpose = "PHONE_LOGIN" | "PHONE_LINK";
type ApiEnvelope<T> = { code?: number; msg?: string; data?: T };

let accessToken: string | undefined;
let accessTokenExpiresAt = 0;
let currentUser: AuthenticatedUser | undefined;

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

function readErrorMessage(body: ApiEnvelope<unknown> | undefined): string {
  return body?.msg || "Authentication request failed.";
}

function authRequest<T>(path: string, options: Omit<UniApp.RequestOptions, "url"> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      url: `${apiBase()}${path}`,
      withCredentials: true,
      header: {
        "Content-Type": "application/json",
        ...(options.header ?? {}),
      },
      success(response) {
        if (response.statusCode === 204) {
          resolve(undefined as T);
          return;
        }
        const envelope = response.data as ApiEnvelope<T>;
        if (response.statusCode >= 200 && response.statusCode < 300 && envelope?.code === 0 && envelope.data !== undefined) {
          resolve(envelope.data);
          return;
        }
        reject(new Error(readErrorMessage(envelope)));
      },
      fail(error) {
        reject(new Error(error.errMsg || "Network request failed."));
      },
    });
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
    forgetDemoToken();
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

  async sendCode(phone: string, purpose: SendCodePurpose = "PHONE_LOGIN"): Promise<void> {
    await authRequest("/auth/codes", {
      method: "POST",
      data: { phone, purpose, deviceId: "uniapp" },
    });
  },

  async phoneLogin(phone: string, code: string): Promise<void> {
    const tokens = await authRequest<AuthTokens>("/auth/phone/login", {
      method: "POST",
      data: { phone, code, audience: "user-api" },
    });
    this.acceptLogin(tokens);
  },

  async beginThirdPartyLogin(provider: ThirdPartyProvider): Promise<PendingOAuthResponse> {
    if (!supportedThirdPartyProviders.includes(provider)) {
      throw new Error("This platform does not support the selected sign-in provider.");
    }

    return beginMiniProgramThirdPartyLogin(provider);
  },

  async completePhoneLink(pendingOauthId: string, phone: string, code: string): Promise<void> {
    const tokens = await authRequest<AuthTokens>("/auth/oauth/link-phone", {
      method: "POST",
      data: { pendingOauthId, phone, code },
    });
    this.acceptLogin(tokens);
  },

  async refresh(): Promise<boolean> {
    try {
      const tokens = await authRequest<AuthTokens>("/auth/refresh", { method: "POST", data: {} });
      this.acceptLogin(tokens);
      return true;
    } catch {
      this.clear();
      return false;
    }
  },

  async logout(): Promise<void> {
    const token = this.getAccessToken();
    try {
      if (token) {
        await authRequest<void>("/auth/logout", {
          method: "POST",
          header: { Authorization: `Bearer ${token}` },
        });
      }
    } finally {
      this.clear();
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

forgetDemoToken();
