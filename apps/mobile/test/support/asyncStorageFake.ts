/**
 * An in-memory AsyncStorage for the tests that look at what a clean-up leaves on the phone. A test mocks
 * `@react-native-async-storage/async-storage` with this and reads `asyncStorageItems` to see what is stored
 * and `asyncStorageRemovals` for the keys removed, in order.
 */
export const asyncStorageItems = new Map<string, string>();
export const asyncStorageRemovals: string[] = [];

export function resetAsyncStorageFake(): void {
  asyncStorageItems.clear();
  asyncStorageRemovals.length = 0;
}

export const asyncStorageFake = {
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(asyncStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => {
      asyncStorageItems.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      asyncStorageRemovals.push(key);
      asyncStorageItems.delete(key);
      return Promise.resolve();
    },
  },
};
