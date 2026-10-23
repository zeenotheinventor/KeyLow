import { readBodyFigure, writeBodyFigure } from "../../lib/bodyFigure";

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

describe("the remembered body figure", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
  });

  describe("reading", () => {
    it("should be Male, not yet chosen, when nothing is stored", async () => {
      await expect(readBodyFigure()).resolves.toEqual({ figure: "male", hasChosen: false });
    });

    it("should read the figure from the bodyMap.figure key, and count it as chosen", async () => {
      mockStorageItems.set("bodyMap.figure", "female");

      await expect(readBodyFigure()).resolves.toEqual({ figure: "female", hasChosen: true });
      expect(mockGetItem).toHaveBeenCalledWith("bodyMap.figure");
    });

    it("should be Male, not yet chosen, for a value that is not a figure", async () => {
      mockStorageItems.set("bodyMap.figure", "other");

      await expect(readBodyFigure()).resolves.toEqual({ figure: "male", hasChosen: false });
    });

    it("should be Male and chosen, so the person is not asked, and never throw, when the store cannot be read", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("storage is down"));

      await expect(readBodyFigure()).resolves.toEqual({ figure: "male", hasChosen: true });
    });
  });

  describe("writing", () => {
    it("should store the figure under the bodyMap.figure key", async () => {
      await writeBodyFigure("female");

      expect(mockSetItem).toHaveBeenCalledWith("bodyMap.figure", "female");
    });

    it("should never throw when the store cannot be written", async () => {
      mockSetItem.mockRejectedValueOnce(new Error("storage is full"));

      await expect(writeBodyFigure("female")).resolves.toBeUndefined();
    });
  });
});
