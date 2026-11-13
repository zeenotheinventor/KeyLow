/**
 * In-memory stand-ins for the keychain and the random source, for the tests that run the diary cache
 * over the real `LargeSecureStore`. A test mocks `expo-secure-store` and `expo-crypto` with these and
 * keeps `secureStoreItems` to look at, or damage, what the keychain holds.
 */
export const secureStoreItems = new Map<string, string>();

export const secureStoreFake = {
  // The values of the real constants do not matter to a fake, only that the cache asks for one.
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  getItemAsync: jest.fn((key: string) => Promise.resolve(secureStoreItems.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    secureStoreItems.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    secureStoreItems.delete(key);
    return Promise.resolve();
  }),
};

export const cryptoFake = {
  getRandomBytes: (byteCount: number) => crypto.getRandomValues(new Uint8Array(byteCount)),
};
