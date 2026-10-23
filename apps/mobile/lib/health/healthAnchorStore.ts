import * as SecureStore from "expo-secure-store";

import type { BodyMeasurementKind } from "@keylow/core/weight";

/*
 * Where this phone has read up to in Health Connect, and when it last finished an import. All of it lives
 * on the device, one key per user (and per body composition kind for the two body anchors), because it
 * describes this phone's Health Connect and not the account. Each kind has its own anchor because body
 * composition can be allowed weeks after weight, and a shared anchor would skip the history still allowed.
 * Losing any of it is harmless (the import key makes every import idempotent), so a store that throws reads
 * as "none" and a write that fails is dropped, and nothing here ever surfaces an error. SecureStore keys
 * may hold letters, digits, ".", "-" and "_", which a user id (a UUID) satisfies.
 */

const anchorKey = (userId: string) => `health-import-anchor.${userId}`;
const bodyAnchorKey = (userId: string, kind: BodyMeasurementKind) =>
  `health-import-anchor.${userId}.${kind}`;
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

/** The ISO instant of the newest sample of `kind` this phone has imported, or null. */
export function getBodyAnchor(userId: string, kind: BodyMeasurementKind): Promise<string | null> {
  return read(bodyAnchorKey(userId, kind));
}

export function setBodyAnchor(
  userId: string,
  kind: BodyMeasurementKind,
  anchor: string,
): Promise<void> {
  return write(bodyAnchorKey(userId, kind), anchor);
}

async function remove(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // The anchor is only an optimisation, so a clear that fails costs a longer read at worst.
  }
}

/** Clears the weight anchor and both body composition anchors of `userId`. */
export async function clearAnchor(userId: string): Promise<void> {
  await Promise.all([
    remove(anchorKey(userId)),
    remove(bodyAnchorKey(userId, "body_fat_pct")),
    remove(bodyAnchorKey(userId, "lean_mass_kg")),
  ]);
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
  getBodyAnchor: typeof getBodyAnchor;
  setBodyAnchor: typeof setBodyAnchor;
  getLastImport: typeof getLastImport;
  setLastImport: typeof setLastImport;
}>;
