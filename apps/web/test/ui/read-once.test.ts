import { describe, expect, it, vi } from "vitest";

import { readOnce } from "@/components/ui/Body3D/Body3DCanvas/readOnce";

describe("readOnce", () => {
  it("should read once however many times it is asked", async () => {
    const read = vi.fn(() => Promise.resolve("model"));
    const readModel = readOnce(read);

    const [first, second] = await Promise.all([readModel(), readModel()]);

    expect(first).toBe("model");
    expect(second).toBe("model");
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("should give every caller the same promise, which is what lets use wait on it", () => {
    const readModel = readOnce(() => Promise.resolve("model"));

    expect(readModel()).toBe(readModel());
  });

  it("should read again on the next ask after a read that failed", async () => {
    const read = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("model");
    const readModel = readOnce(read);

    await expect(readModel()).rejects.toThrow("offline");

    await expect(readModel()).resolves.toBe("model");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("should not read again after a read that worked", async () => {
    const read = vi.fn(() => Promise.resolve("model"));
    const readModel = readOnce(read);

    await readModel();
    await readModel();

    expect(read).toHaveBeenCalledTimes(1);
  });
});
