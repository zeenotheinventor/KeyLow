import { keys } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { secureStoreItems } from "./support/diaryCacheStoresFake";
import { DIARY_CACHE_STORAGE_KEY } from "../lib/diaryCache/constants";
import { createDiaryCachePersister } from "../lib/diaryCache/createDiaryCachePersister";
import { createDiaryCacheStorage } from "../lib/diaryCache/createDiaryCacheStorage";

import type { PersistedClient } from "@tanstack/react-query-persist-client";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: jest.requireActual<object>(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
}));
jest.mock(
  "expo-secure-store",
  () =>
    jest.requireActual<{ secureStoreFake: unknown }>("./support/diaryCacheStoresFake")
      .secureStoreFake,
);
jest.mock(
  "expo-crypto",
  () => jest.requireActual<{ cryptoFake: unknown }>("./support/diaryCacheStoresFake").cryptoFake,
);

const OWNER = "11111111-1111-4111-8111-111111111111";
const FOOD_NAME = "Porridge oats";
const CALORIES = 187654;
const signedInAs = () => Promise.resolve(OWNER);

function aCache(): PersistedClient {
  const query = (queryKey: readonly unknown[], data: unknown) => ({
    queryKey,
    queryHash: JSON.stringify(queryKey),
    dehydratedAt: Date.now(),
    state: {
      data,
      dataUpdateCount: 1,
      dataUpdatedAt: Date.now(),
      error: null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      fetchFailureCount: 0,
      fetchFailureReason: null,
      fetchMeta: null,
      isInvalidated: false,
      status: "success" as const,
      fetchStatus: "idle" as const,
    },
  });

  return {
    buster: "any",
    timestamp: Date.now(),
    clientState: {
      mutations: [],
      queries: [
        query(keys.profiles.termsAcceptance, {
          terms_accepted_at: "2026-10-15T09:30:00+00:00",
          terms_version: TERMS_VERSION,
        }),
        query(keys.diary.day("2026-10-15"), {
          entries: [{ id: "entry-1", name: FOOD_NAME, calories: CALORIES }],
        }),
        query(keys.profiles.targets, { calories: 2150, protein_g: 140 }),
      ],
    },
  };
}

const newPersister = () => createDiaryCachePersister(createDiaryCacheStorage(), signedInAs);

describe("the encrypted diary cache", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    secureStoreItems.clear();
    jest.clearAllMocks();
  });

  it("should store a blob that is not plaintext, with its key in the keychain only", async () => {
    await newPersister().persistClient(aCache());

    const stored = await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(stored).not.toContain(FOOD_NAME);
    expect(stored).not.toContain(String(CALORIES));
    expect(() => {
      JSON.parse(stored ?? "");
    }).toThrow();
    expect(secureStoreItems.has(DIARY_CACHE_STORAGE_KEY)).toBe(true);
  });

  it("should keep the key in the keychain that does not leave the device", async () => {
    await newPersister().persistClient(aCache());

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      DIARY_CACHE_STORAGE_KEY,
      expect.any(String),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  });

  it("should restore what was stored, from a new persister over the same stores", async () => {
    const cache = aCache();
    await newPersister().persistClient(cache);

    await expect(newPersister().restoreClient()).resolves.toEqual(cache);
  });

  it("should discard the cache when its key is missing", async () => {
    await newPersister().persistClient(aCache());
    secureStoreItems.delete(DIARY_CACHE_STORAGE_KEY);

    await expect(newPersister().restoreClient()).resolves.toBeUndefined();

    expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
    expect(secureStoreItems.has(DIARY_CACHE_STORAGE_KEY)).toBe(false);
  });

  it("should discard the cache when the keychain read throws", async () => {
    await newPersister().persistClient(aCache());
    jest
      .mocked(SecureStore.getItemAsync)
      .mockRejectedValueOnce(new Error("key permanently invalidated"));

    await expect(newPersister().restoreClient()).resolves.toBeUndefined();

    expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
    expect(secureStoreItems.has(DIARY_CACHE_STORAGE_KEY)).toBe(false);
  });

  it("should discard a plaintext cache left by an earlier build, and remove it", async () => {
    await AsyncStorage.setItem(
      DIARY_CACHE_STORAGE_KEY,
      JSON.stringify({ ...aCache(), buster: `any|${OWNER}` }),
    );

    await expect(newPersister().restoreClient()).resolves.toBeUndefined();

    expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it("should remove a plaintext cache that meets a stale key", async () => {
    await newPersister().persistClient(aCache());
    await AsyncStorage.setItem(DIARY_CACHE_STORAGE_KEY, JSON.stringify(aCache()));

    // Whether the stale key makes the read throw or yield text that is no cache, nothing comes back.
    const restored = await Promise.resolve(newPersister().restoreClient()).catch(() => undefined);

    expect(restored).toBeUndefined();
    expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it("should remove the ciphertext and the key on sign out, so the next user starts empty", async () => {
    const persister = newPersister();
    await persister.persistClient(aCache());

    await persister.removeClient();

    expect(await AsyncStorage.getItem(DIARY_CACHE_STORAGE_KEY)).toBeNull();
    expect(secureStoreItems.has(DIARY_CACHE_STORAGE_KEY)).toBe(false);
    await expect(newPersister().restoreClient()).resolves.toBeUndefined();
  });

  it("should not put the cache, its key or its words in an error when the keychain fails", async () => {
    await newPersister().persistClient(aCache());
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error("keychain unavailable"));
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const warnLog = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await newPersister().restoreClient();

    expect(errorLog).not.toHaveBeenCalled();
    expect(warnLog).not.toHaveBeenCalled();
  });
});
