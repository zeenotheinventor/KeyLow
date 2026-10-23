import { bundledModel } from "../../components/ui/Body3D/bundledModel";

const mockModel = { meshes: new Map() };
jest.mock("@keylow/body-3d", () => ({ loadBodyModel: () => Promise.resolve(mockModel) }));
const mockLoadAsset = jest.fn<Promise<{ localUri: string }[]>, [number]>();
jest.mock("expo-asset", () => ({
  Asset: { loadAsync: (source: number) => mockLoadAsset(source) },
}));
jest.mock("expo-file-system", () => ({
  File: class {
    bytes() {
      return Promise.resolve(new Uint8Array(4));
    }
  },
}));

describe("bundledModel", () => {
  beforeEach(() => {
    mockLoadAsset.mockReset();
  });

  it("should read a model once however many times it is asked for", async () => {
    mockLoadAsset.mockResolvedValue([{ localUri: "file:///cache/once.glb" }]);

    const first = await bundledModel(1);
    const second = await bundledModel(1);

    expect(second).toBe(first);
    expect(mockLoadAsset).toHaveBeenCalledTimes(1);
  });

  it("should read again after a read failed, and not keep the failure", async () => {
    mockLoadAsset.mockRejectedValueOnce(new Error("offline cache miss"));
    mockLoadAsset.mockResolvedValueOnce([{ localUri: "file:///cache/retry.glb" }]);

    await expect(bundledModel(2)).rejects.toThrow("offline cache miss");

    await expect(bundledModel(2)).resolves.toBe(mockModel);
  });
});
