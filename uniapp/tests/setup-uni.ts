const storage = new Map<string, unknown>();

const uniMock = {
  getStorageSync(key: string) {
    return storage.get(key) ?? "";
  },
  setStorageSync(key: string, value: unknown) {
    storage.set(key, value);
  },
  setStorage({ key, data }: UniApp.SetStorageOptions) {
    storage.set(key, data);
  },
  removeStorageSync(key: string) {
    storage.delete(key);
  },
  getSystemInfoSync() {
    return { uniPlatform: "web" };
  },
  reLaunch() {},
};

const currentPage = { route: "pages/home/home" };
Object.assign(globalThis, { uni: uniMock, getCurrentPages: () => [currentPage] });
