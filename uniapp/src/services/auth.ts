const DEMO_TOKEN_KEY = "lingdian_demo_token";
const DEMO_TOKEN = "demo-token";

export function ensureDemoToken() {
  const token = uni.getStorageSync(DEMO_TOKEN_KEY);
  if (token) {
    return String(token);
  }

  uni.setStorageSync(DEMO_TOKEN_KEY, DEMO_TOKEN);
  return DEMO_TOKEN;
}

export function getDemoToken() {
  return ensureDemoToken();
}

