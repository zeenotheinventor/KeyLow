import * as SecureStore from "expo-secure-store";

/*
 * Where this phone has read up to in Health Connect, and when it last finished an import. Both live on
 * the device, one key per user, because they describe this phone's Health Connect and not the account.
 * Losing either is harmless (the import key makes every import idempotent), so a store that throws reads
 * as "none" and a write that fails is dropped, and nothing here ever surfaces an error. SecureStore keys
 * may hold letters, digits, ".", "-" and "_", which a user id (a UUID) satisfies.
 */

const anchorKey = (userId: string) => `health-import-anchor.${userId}`;
const lastImportKey = (userId: string) => `health-import-last.${userId}`;

async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Dropped on purpose: the next import reads a little further back and stores nothing twice.
  }
}

/** The ISO instant of the newest sample this phone has imported, or null. */
export function getAnchor(userId: string): Promise<string | null> {
  return read(anchorKey(userId));
}

export function setAnchor(userId: string, anchor: string): Promise<void> {
  return write(anchorKey(userId), anchor);
}

export async function clearAnchor(userId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(anchorKey(userId));
  } catch {
    // The anchor is only an optimisation, so a clear that fails costs a longer read at worst.
  }
}

/** The ISO instant at which an import last ended as imported or nothing-new, or null. */
export function getLastImport(userId: string): Promise<string | null> {
  return read(lastImportKey(userId));
}

export function setLastImport(userId: string, lastImport: string): Promise<void> {
  return write(lastImportKey(userId), lastImport);
}

/** What the import runner needs of the store, so a test can pass an in-memory one. */
export type HealthAnchorStore = Readonly<{
  getAnchor: typeof getAnchor;
  setAnchor: typeof setAnchor;
  getLastImport: typeof getLastImport;
  setLastImport: typeof setLastImport;
}>;
