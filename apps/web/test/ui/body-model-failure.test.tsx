import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The canvas asks for the model on every render, through `use`. If a failure were forgotten, each ask would start a new
// fetch and a new promise, the error would never settle for the boundary to catch, and the page would fetch in a loop
// until the 8 second timeout. jsdom cannot make `use` retry, so what the loop is made of is tested here: every ask after
// a failure gets the same failed promise, and the file was asked for once. The boundary reporting it once is proved in
// a browser, by counting the requests with the file blocked.
describe("a body model that cannot be fetched", () => {
  const fetchModel = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchModel.mockReset();
    vi.stubGlobal("fetch", fetchModel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it.each([
    ["answers with an error status", () => Promise.resolve(new Response(null, { status: 500 }))],
    ["cannot be reached", () => Promise.reject(new TypeError("Failed to fetch"))],
  ])(
    "should be asked for once, and fail the same way for every ask after, when the file %s",
    async (_name, answer) => {
      // A fresh module for each case, since the read is kept for the page.
      const { maleBodyModel: freshModel } =
        await import("@/components/ui/Body3D/Body3DCanvas/bodyModel");
      fetchModel.mockImplementation(answer);

      const first = freshModel();
      await expect(first).rejects.toThrow();
      for (let ask = 0; ask < 5; ask += 1) {
        expect(freshModel()).toBe(first);
        await expect(freshModel()).rejects.toThrow();
      }

      expect(fetchModel).toHaveBeenCalledTimes(1);
    },
  );
});
