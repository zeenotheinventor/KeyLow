import { afterEach, describe, expect, it, vi } from "vitest";

// A real folder lists its entries in whatever order the file system likes, and APFS already sorts
// them. This stands in for a file system that does not, so the sort in listCanvasSources is pinned.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: () => true,
    readdirSync: () => ["source-m4", "source-m3", "source", "source-m10", "web"],
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listCanvasSources order", () => {
  it("should list source first and the other folders by name, whatever order the file system gives", async () => {
    const { listCanvasSources } = await import("../src/canvasSources.ts");
    expect(listCanvasSources("/design")).toEqual([
      "source",
      "source-m10",
      "source-m3",
      "source-m4",
    ]);
  });
});
