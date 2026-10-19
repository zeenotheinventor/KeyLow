import { readBodyMapView, writeBodyMapView } from "../../lib/bodyMapView";

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

describe("the remembered body map view", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
  });

  describe("reading", () => {
    it("should be Actual when nothing is stored", async () => {
      await expect(readBodyMapView()).resolves.toBe("actual");
    });

    it("should read the view from the bodyMap.view key", async () => {
      mockStorageItems.set("bodyMap.view", "projected");

      await expect(readBodyMapView()).resolves.toBe("projected");
      expect(mockGetItem).toHaveBeenCalledWith("bodyMap.view");
    });

    it("should fall back to Actual for a value that is not a view", async () => {
      mockStorageItems.set("bodyMap.view", "gap");

      await expect(readBodyMapView()).resolves.toBe("actual");
    });

    it("should fall back to Actual, and never throw, when the store cannot be read", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("storage is down"));

      await expect(readBodyMapView()).resolves.toBe("actual");
    });
  });

  describe("writing", () => {
    it("should store the view under the bodyMap.view key", async () => {
      await writeBodyMapView("projected");

      expect(mockSetItem).toHaveBeenCalledWith("bodyMap.view", "projected");
    });

    it("should never throw when the store cannot be written", async () => {
      mockSetItem.mockRejectedValueOnce(new Error("storage is full"));

      await expect(writeBodyMapView("projected")).resolves.toBeUndefined();
    });
  });
});
