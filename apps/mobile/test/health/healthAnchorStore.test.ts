import * as SecureStore from "expo-secure-store";

import {
  clearAnchor,
  getAnchor,
  getBodyAnchor,
  getLastImport,
  setAnchor,
  setBodyAnchor,
  setLastImport,
} from "../../lib/health/healthAnchorStore";

const mockSecureStoreItems = new Map<string, string>();

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

const userId = "0b6f5c2e-4f6a-4e0a-9d52-6a1f6d8f3c11";
const otherUserId = "7c1d9f3a-2b5e-4a8c-8f21-3e4d5a6b7c8d";
const anchor = "2026-10-03T07:30:00.000Z";

beforeEach(() => {
  mockSecureStoreItems.clear();
  jest.clearAllMocks();
});

describe("the anchor", () => {
  it("should be none until one is set", async () => {
    await expect(getAnchor(userId)).resolves.toBeNull();
  });

  it("should read back what was set", async () => {
    await setAnchor(userId, anchor);

    await expect(getAnchor(userId)).resolves.toBe(anchor);
  });

  it("should be kept per user", async () => {
    await setAnchor(userId, anchor);

    await expect(getAnchor(otherUserId)).resolves.toBeNull();
  });

  it("should be stored under the key the data model names", async () => {
    await setAnchor(userId, anchor);

    expect(mockSecureStoreItems.get(`health-import-anchor.${userId}`)).toBe(anchor);
  });

  it("should be none after it is cleared", async () => {
    await setAnchor(userId, anchor);

    await clearAnchor(userId);

    await expect(getAnchor(userId)).resolves.toBeNull();
  });

  it("should be none when the store cannot be read", async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error("keystore locked"));

    await expect(getAnchor(userId)).resolves.toBeNull();
  });

  it("should not throw when the store cannot be written", async () => {
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error("keystore locked"));

    await expect(setAnchor(userId, anchor)).resolves.toBeUndefined();
  });

  it("should not throw when the store cannot be cleared", async () => {
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error("keystore locked"));

    await expect(clearAnchor(userId)).resolves.toBeUndefined();
  });
});

describe("the body composition anchors", () => {
  const bodyKinds = ["body_fat_pct", "lean_mass_kg"] as const;

  it.each(bodyKinds)("should be none for %s until one is set", async (kind) => {
    await expect(getBodyAnchor(userId, kind)).resolves.toBeNull();
  });

  it.each(bodyKinds)("should read back what was set for %s", async (kind) => {
    await setBodyAnchor(userId, kind, anchor);

    await expect(getBodyAnchor(userId, kind)).resolves.toBe(anchor);
  });

  it.each(bodyKinds)("should be stored for %s under the key the ticket names", async (kind) => {
    await setBodyAnchor(userId, kind, anchor);

    expect(mockSecureStoreItems.get(`health-import-anchor.${userId}.${kind}`)).toBe(anchor);
  });

  it("should keep each kind apart from the other and from the weight anchor", async () => {
    await setBodyAnchor(userId, "body_fat_pct", anchor);

    await expect(getBodyAnchor(userId, "lean_mass_kg")).resolves.toBeNull();
    await expect(getAnchor(userId)).resolves.toBeNull();
  });

  it("should not move the weight anchor when one is set", async () => {
    await setAnchor(userId, anchor);
    await setBodyAnchor(userId, "body_fat_pct", "2026-10-10T07:30:00.000Z");

    await expect(getAnchor(userId)).resolves.toBe(anchor);
  });

  it("should be kept per user", async () => {
    await setBodyAnchor(userId, "body_fat_pct", anchor);

    await expect(getBodyAnchor(otherUserId, "body_fat_pct")).resolves.toBeNull();
  });

  it.each(bodyKinds)("should be none for %s when the store cannot be read", async (kind) => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error("keystore locked"));

    await expect(getBodyAnchor(userId, kind)).resolves.toBeNull();
  });

  it.each(bodyKinds)("should not throw for %s when the store cannot be written", async (kind) => {
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error("keystore locked"));

    await expect(setBodyAnchor(userId, kind, anchor)).resolves.toBeUndefined();
  });

  it("should be removed along with the weight anchor when the anchors are cleared", async () => {
    await setAnchor(userId, anchor);
    await setBodyAnchor(userId, "body_fat_pct", anchor);
    await setBodyAnchor(userId, "lean_mass_kg", anchor);
    await setBodyAnchor(otherUserId, "body_fat_pct", anchor);

    await clearAnchor(userId);

    await expect(getAnchor(userId)).resolves.toBeNull();
    await expect(getBodyAnchor(userId, "body_fat_pct")).resolves.toBeNull();
    await expect(getBodyAnchor(userId, "lean_mass_kg")).resolves.toBeNull();
    await expect(getBodyAnchor(otherUserId, "body_fat_pct")).resolves.toBe(anchor);
  });

  it("should still clear the others when one key cannot be deleted", async () => {
    await setBodyAnchor(userId, "lean_mass_kg", anchor);
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error("keystore locked"));

    await expect(clearAnchor(userId)).resolves.toBeUndefined();

    await expect(getBodyAnchor(userId, "lean_mass_kg")).resolves.toBeNull();
  });
});

describe("the last import time", () => {
  it("should be none until one is set", async () => {
    await expect(getLastImport(userId)).resolves.toBeNull();
  });

  it("should read back what was set, apart from the anchor", async () => {
    await setLastImport(userId, "2026-10-23T09:00:00.000Z");

    await expect(getLastImport(userId)).resolves.toBe("2026-10-23T09:00:00.000Z");
    await expect(getAnchor(userId)).resolves.toBeNull();
  });

  it("should be stored under the key the ticket names", async () => {
    await setLastImport(userId, anchor);

    expect(mockSecureStoreItems.get(`health-import-last.${userId}`)).toBe(anchor);
  });

  it("should be kept per user", async () => {
    await setLastImport(userId, anchor);

    await expect(getLastImport(otherUserId)).resolves.toBeNull();
  });

  it("should be none when the store cannot be read", async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error("keystore locked"));

    await expect(getLastImport(userId)).resolves.toBeNull();
  });

  it("should not throw when the store cannot be written", async () => {
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error("keystore locked"));

    await expect(setLastImport(userId, anchor)).resolves.toBeUndefined();
  });
});
