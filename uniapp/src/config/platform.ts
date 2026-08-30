export type MiniProgramAuthProvider = "WECHAT" | "QQ";

export function currentUniPlatform(): string {
  try {
    const platform = uni.getSystemInfoSync().uniPlatform;
    if (typeof platform === "string") return platform;
  } catch {
    // Fall through to the compile-time H5 default below.
  }

  // #ifdef H5
  return "web";
  // #endif

  return "";
}

export function usesBrowserCookieTransport(): boolean {
  return currentUniPlatform() === "web";
}

export function miniProgramAuthProvider(): MiniProgramAuthProvider | undefined {
  const platform = currentUniPlatform();
  if (platform === "mp-weixin") return "WECHAT";
  if (platform === "mp-qq") return "QQ";
  return undefined;
}
