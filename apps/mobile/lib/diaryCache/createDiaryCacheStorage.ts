import * as SecureStore from "expo-secure-store";

import { LargeSecureStore } from "../LargeSecureStore";

/**
 * Where the diary cache is stored: AES-256-CTR ciphertext in AsyncStorage, so a device backup holds
 * nothing readable, with the key in the keychain. The key is kept to this device, so a restore on
 * another one brings the ciphertext without a key to open it, and the cache is then discarded.
 *
 * Imported by its path and kept out of the `diaryCache` barrel, because it pulls in native AsyncStorage,
 * which the tests that use the barrel do not mock.
 */
export function createDiaryCacheStorage(): LargeSecureStore {
  return new LargeSecureStore({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
