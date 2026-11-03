import { compileStylesWithCache } from "./support/nativeWindStyles";

// Typed by hand because the app has no Node type definitions.
const { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } = jest.requireActual<{
  mkdtempSync: (prefix: string) => string;
  readdirSync: (path: string) => string[];
  readFileSync: (path: string, encoding: "utf8") => string;
  rmSync: (path: string, options: { recursive: true; force: true }) => void;
  writeFileSync: (path: string, data: string) => void;
}>("node:fs");
const { tmpdir } = jest.requireActual<{ tmpdir: () => string }>("node:os");

const globalStyles = "@tailwind utilities;";

describe("compileStylesWithCache", () => {
  let cacheDirectory: string;

  beforeEach(() => {
    cacheDirectory = mkdtempSync(`${tmpdir()}/kit-styles-test-`);
  });

  afterEach(() => {
    rmSync(cacheDirectory, { recursive: true, force: true });
  });

  function cachedFiles(): string[] {
    return readdirSync(cacheDirectory);
  }

  it("should write the compiled styles to the cache on a miss", async () => {
    const css = await compileStylesWithCache({ classNames: "p-1", globalStyles, cacheDirectory });

    expect(css).toContain("padding");
    expect(cachedFiles()).toHaveLength(1);
    expect(readFileSync(`${cacheDirectory}/${cachedFiles()[0]}`, "utf8")).toBe(css);
  });

  it("should give a hit the same styles as the miss, read from the cache file", async () => {
    const compiled = await compileStylesWithCache({
      classNames: "p-1",
      globalStyles,
      cacheDirectory,
    });
    writeFileSync(`${cacheDirectory}/${cachedFiles()[0]}`, compiled.replace("p-1", "marked"));

    const cached = await compileStylesWithCache({
      classNames: "p-1",
      globalStyles,
      cacheDirectory,
    });

    expect(cached).toBe(compiled.replace("p-1", "marked"));
    expect(cachedFiles()).toHaveLength(1);
  });

  it("should miss when a class name changes", async () => {
    await compileStylesWithCache({ classNames: "p-1", globalStyles, cacheDirectory });

    const css = await compileStylesWithCache({ classNames: "p-2", globalStyles, cacheDirectory });

    expect(css).toContain("p-2");
    expect(cachedFiles()).toHaveLength(2);
  });

  it("should miss when global.css changes", async () => {
    await compileStylesWithCache({ classNames: "p-1", globalStyles, cacheDirectory });

    const css = await compileStylesWithCache({
      classNames: "p-1",
      globalStyles: `${globalStyles}\n.added-rule { color: red; }`,
      cacheDirectory,
    });

    expect(css).toContain(".added-rule");
    expect(cachedFiles()).toHaveLength(2);
  });

  it("should leave no temporary file behind", async () => {
    await compileStylesWithCache({ classNames: "p-1", globalStyles, cacheDirectory });

    expect(cachedFiles().every((file) => file.endsWith(".css"))).toBe(true);
  });
});
