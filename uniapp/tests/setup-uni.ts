const storage = new Map<string, unknown>();

const uniMock = {
  getStorageSync(key: string) {
    return storage.get(key) ?? "";
  },
  setStorageSync(key: string, value: unknown) {
    storage.set(key, value);
  },
  removeStorageSync(key: string) {
    storage.delete(key);
  },
  getSystemInfoSync() {
    return { uniPlatform: "web" };
  },
  reLaunch() {},
};

Object.assign(globalThis, { uni: uniMock });
