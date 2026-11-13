import AsyncStorage from "@react-native-async-storage/async-storage";
import { Counter, ModeOfOperation, utils } from "aes-js";
import { getRandomBytes } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const encryptionKeyByteCount = 32;

type LargeSecureStoreOptions = {
  /**
   * When the keychain gives the key out, and whether a backup carries it. Left out, the key is written
   * with the keychain's own default, which is how the session is stored.
   */
  keychainAccessible?: SecureStore.KeychainAccessibilityConstant;
};

/**
 * Storage for supabase-js sessions. SecureStore refuses values over 2048 bytes and a session is
 * larger, so the session is AES-256-CTR encrypted into AsyncStorage and only the encryption key,
 * a fresh one on every write, lives in SecureStore under the same storage key.
 */
export class LargeSecureStore {
  private readonly keyStoreOptions: SecureStore.SecureStoreOptions | undefined;

  constructor({ keychainAccessible }: LargeSecureStoreOptions = {}) {
    this.keyStoreOptions = keychainAccessible === undefined ? undefined : { keychainAccessible };
  }

  async getItem(key: string): Promise<string | null> {
    const ciphertextHex = await AsyncStorage.getItem(key);
    if (ciphertextHex === null) {
      return null;
    }

    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (encryptionKeyHex === null) {
      return null;
    }

    const cipher = new ModeOfOperation.ctr(utils.hex.toBytes(encryptionKeyHex), new Counter(1));
    return utils.utf8.fromBytes(cipher.decrypt(utils.hex.toBytes(ciphertextHex)));
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = getRandomBytes(encryptionKeyByteCount);
    const cipher = new ModeOfOperation.ctr(encryptionKey, new Counter(1));
    const ciphertext = cipher.encrypt(utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, utils.hex.fromBytes(encryptionKey), this.keyStoreOptions);
    await AsyncStorage.setItem(key, utils.hex.fromBytes(ciphertext));
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}
