import { readBodyMapHintSeen, writeBodyMapHintSeen } from "../../lib/bodyMapHint";

const mockStorageItems = new Map<string, string>();
const mockGetItem = jest.fn((key: string) => Promise.resolve(mockStorageItems.get(key) ?? null));
const mockSetItem = jest.fn((key: string, value: string) => {
  mockStorageItems.set(key, value);
  return Promise.resolve();
});

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

describe("the first-open hint flag", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
  });

  describe("reading", () => {
    it("should be not seen when nothing is stored", async () => {
      await expect(readBodyMapHintSeen()).resolves.toBe(false);
    });

    it("should be seen when the bodyMap.hintSeen key holds true", async () => {
      mockStorageItems.set("bodyMap.hintSeen", "true");

      await expect(readBodyMapHintSeen()).resolves.toBe(true);
      expect(mockGetItem).toHaveBeenCalledWith("bodyMap.hintSeen");
    });

    it("should be not seen for a value that is not true", async () => {
      mockStorageItems.set("bodyMap.hintSeen", "yes");

      await expect(readBodyMapHintSeen()).resolves.toBe(false);
    });

    it("should count as seen, so nothing is shown, and never throw, when the store cannot be read", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("storage is down"));

      await expect(readBodyMapHintSeen()).resolves.toBe(true);
    });
  });

  describe("writing", () => {
    it("should store true under the bodyMap.hintSeen key", async () => {
      await writeBodyMapHintSeen();

      expect(mockSetItem).toHaveBeenCalledWith("bodyMap.hintSeen", "true");
    });

    it("should never throw when the store cannot be written", async () => {
      mockSetItem.mockRejectedValueOnce(new Error("storage is full"));

      await expect(writeBodyMapHintSeen()).resolves.toBeUndefined();
    });
  });
});
