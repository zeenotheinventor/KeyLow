import {
  clearRecoveryRequest,
  readRecoveryRequestedAt,
  recordRecoveryRequest,
  recoveryRequestStorageKey,
} from "../lib/recoveryRequest";

const mockStorageItems = new Map<string, string>();
const mockGetItem = jest.fn((key: string) => Promise.resolve(mockStorageItems.get(key) ?? null));
const mockSetItem = jest.fn((key: string, value: string) => {
  mockStorageItems.set(key, value);
  return Promise.resolve();
});
const mockRemoveItem = jest.fn((key: string) => {
  mockStorageItems.delete(key);
  return Promise.resolve();
});

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
    removeItem: (key: string) => mockRemoveItem(key),
  },
}));

describe("recovery request marker", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
    mockRemoveItem.mockClear();
  });

  it("should read back the time it was recorded", async () => {
    await recordRecoveryRequest(1_700_000_000_000);

    await expect(readRecoveryRequestedAt()).resolves.toBe(1_700_000_000_000);
  });

  it("should store epoch milliseconds as a string and nothing else", async () => {
    await recordRecoveryRequest(1_700_000_000_000);

    expect([...mockStorageItems.entries()]).toEqual([[recoveryRequestStorageKey, "1700000000000"]]);
  });

  it("should record the current time when none is given", async () => {
    jest.useFakeTimers({ now: 1_700_000_123_000 });
    try {
      await recordRecoveryRequest();
    } finally {
      jest.useRealTimers();
    }

    await expect(readRecoveryRequestedAt()).resolves.toBe(1_700_000_123_000);
  });

  it("should read nothing when no request was recorded", async () => {
    await expect(readRecoveryRequestedAt()).resolves.toBeNull();
  });

  it("should read nothing once cleared", async () => {
    await recordRecoveryRequest(1_700_000_000_000);

    await clearRecoveryRequest();

    await expect(readRecoveryRequestedAt()).resolves.toBeNull();
  });

  it("should read nothing for a value that is not a time", async () => {
    mockStorageItems.set(recoveryRequestStorageKey, "yesterday");

    await expect(readRecoveryRequestedAt()).resolves.toBeNull();
  });

  describe("when the storage fails", () => {
    it("should read nothing", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("storage unavailable"));

      await expect(readRecoveryRequestedAt()).resolves.toBeNull();
    });

    it("should not throw when writing", async () => {
      mockSetItem.mockRejectedValueOnce(new Error("storage full"));

      await expect(recordRecoveryRequest(1_700_000_000_000)).resolves.toBeUndefined();
    });

    it("should not throw when clearing", async () => {
      mockRemoveItem.mockRejectedValueOnce(new Error("storage unavailable"));

      await expect(clearRecoveryRequest()).resolves.toBeUndefined();
    });
  });
});
