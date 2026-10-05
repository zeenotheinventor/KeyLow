import { LargeSecureStore } from "../lib/LargeSecureStore";

const mockSecureStoreItems = new Map<string, string>();
const mockAsyncStorageItems = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStoreItems.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStoreItems.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockSecureStoreItems.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorageItems.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockAsyncStorageItems.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      mockAsyncStorageItems.delete(key);
      return Promise.resolve();
    }),
  },
}));

jest.mock("expo-crypto", () => ({
  getRandomBytes: (byteCount: number) => crypto.getRandomValues(new Uint8Array(byteCount)),
}));

const storageKey = "sb-localhost-auth-token";

describe("LargeSecureStore", () => {
  beforeEach(() => {
    mockSecureStoreItems.clear();
    mockAsyncStorageItems.clear();
  });

  it("should return the original value after a round trip", async () => {
    const store = new LargeSecureStore();

    await store.setItem(storageKey, '{"access_token":"abc"}');

    await expect(store.getItem(storageKey)).resolves.toBe('{"access_token":"abc"}');
  });

  it("should not keep the plaintext in AsyncStorage", async () => {
    const store = new LargeSecureStore();

    await store.setItem(storageKey, '{"access_token":"abc"}');

    const stored = mockAsyncStorageItems.get(storageKey);
    expect(stored).toBeDefined();
    expect(stored).not.toContain("access_token");
  });

  it("should keep only the encryption key in SecureStore", async () => {
    const store = new LargeSecureStore();
    const largeValue = "x".repeat(5000);

    await store.setItem(storageKey, largeValue);

    expect(mockSecureStoreItems.get(storageKey)).toHaveLength(64);
    await expect(store.getItem(storageKey)).resolves.toBe(largeValue);
  });

  it("should return null when nothing is stored", async () => {
    const store = new LargeSecureStore();

    await expect(store.getItem(storageKey)).resolves.toBeNull();
  });

  it("should return null when the ciphertext exists but its key is missing", async () => {
    const store = new LargeSecureStore();
    await store.setItem(storageKey, "value");
    mockSecureStoreItems.delete(storageKey);

    await expect(store.getItem(storageKey)).resolves.toBeNull();
  });

  it("should clear both stores on removeItem", async () => {
    const store = new LargeSecureStore();
    await store.setItem(storageKey, "value");

    await store.removeItem(storageKey);

    expect(mockSecureStoreItems.has(storageKey)).toBe(false);
    expect(mockAsyncStorageItems.has(storageKey)).toBe(false);
    await expect(store.getItem(storageKey)).resolves.toBeNull();
  });
});
