import { cssToReactNativeRuntimeOptions } from "nativewind/dist/metro/common";
import postcss from "postcss";
import { registerCSS, setupAllComponents } from "react-native-css-interop/test";
import tailwindcss from "tailwindcss";

import type { Config } from "tailwindcss";

// Typed by hand because the app has no Node type definitions.
type Hash = { update: (data: string) => Hash; digest: (encoding: "hex") => string };
const { createHash } = jest.requireActual<{ createHash: (algorithm: "sha256") => Hash }>(
  "node:crypto",
);
const { mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } =
  jest.requireActual<{
    mkdirSync: (path: string, options: { recursive: true }) => void;
    readFileSync: (path: string, encoding: "utf8") => string;
    readdirSync: (path: string, options: { recursive: true; encoding: "utf8" }) => string[];
    renameSync: (from: string, to: string) => void;
    unlinkSync: (path: string) => void;
    writeFileSync: (path: string, data: string) => void;
  }>("node:fs");
const { dirname } = jest.requireActual<{ dirname: (path: string) => string }>("node:path");

const defaultCacheDirectory = "node_modules/.cache/kit-styles";

/** Everything the compile reads, so the cache can be keyed on all of it. */
type CompileInputs = {
  /** The class names to build, which already hold every source file's text. */
  classNames: string;
  /** The text of `global.css`. */
  globalStyles: string;
  /** Where the compiled styles are kept. */
  cacheDirectory?: string;
};

const packagesThatShapeTheStyles = [
  "tailwindcss",
  "nativewind",
  "react-native-css-interop",
  "postcss",
];

function installedVersions(): string[] {
  return packagesThatShapeTheStyles.map((name) => {
    const { version } = jest.requireActual<{ version: string }>(`${name}/package.json`);
    return `${name}@${version}`;
  });
}

function filesIn(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.[a-z]+$/.test(file))
    .sort()
    .map((file) => `${file}\n${readFileSync(`${directory}/${file}`, "utf8")}`);
}

/**
 * The text of the Tailwind config and of every workspace file it loads. The config loads only
 * `@keylow/tokens`, and all of that package's source is read, so a token change is never missed. The
 * NativeWind preset lives in `node_modules`, so its version stands for it. This file is part of it
 * too, so a change to how the styles are compiled starts a fresh cache.
 */
function configurationSources(): string[] {
  const tokensSourceDirectory = dirname(require.resolve("@keylow/tokens"));

  return [
    readFileSync("tailwind.config.js", "utf8"),
    // A catch-all for a change deep in a dependency that no version above shows.
    readFileSync("../../pnpm-lock.yaml", "utf8"),
    readFileSync(__filename, "utf8"),
    ...filesIn(tokensSourceDirectory),
  ];
}

function cacheKey({ classNames, globalStyles }: CompileInputs, nativeWindOs: string): string {
  const hash = createHash("sha256");
  const parts = [
    classNames,
    globalStyles,
    nativeWindOs,
    ...installedVersions(),
    ...configurationSources(),
  ];
  // The length goes before each part, so two different splits of the same text never share a key.
  parts.forEach((part) => hash.update(`${part.length}:`).update(part));

  return hash.digest("hex");
}

function readCached(file: string): string | undefined {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Writes beside the final file and renames into place, so a worker that reads never sees half a file.
 * The cache only saves time, so a folder that cannot be written (read-only, full, no permission)
 * costs the saving and nothing else.
 */
function writeCached(directory: string, file: string, css: string): void {
  const temporaryFile = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporaryFile, css);
    renameSync(temporaryFile, file);
  } catch {
    try {
      unlinkSync(temporaryFile);
    } catch {
      // There was no temporary file to remove.
    }
  }
}

/**
 * Compiles the app's Tailwind config and `global.css` for the class names given, or returns the
 * styles an earlier compile of exactly the same inputs left in the cache folder. The key covers the
 * class names, `global.css`, the config and the tokens it loads, the lockfile, the versions of the packages that
 * build the styles, and the NativeWind platform, so changed sources are never served stale.
 */
export async function compileStylesWithCache(inputs: CompileInputs): Promise<string> {
  // The NativeWind preset picks its native or web flavour from this when Tailwind reads the config.
  const nativeWindOs = "android";
  process.env.NATIVEWIND_OS = nativeWindOs;
  const directory = inputs.cacheDirectory ?? defaultCacheDirectory;
  const file = `${directory}/${cacheKey(inputs, nativeWindOs)}.css`;

  const cached = readCached(file);
  if (cached !== undefined) {
    return cached;
  }

  if (process.env.KIT_STYLES_LOG_MISSES) {
    process.stderr.write("kit-styles cache miss\n");
  }
  const config = jest.requireActual<Config>("../../tailwind.config.js");
  const { css } = await postcss([
    tailwindcss({ ...config, content: [{ raw: inputs.classNames }] }),
  ]).process(inputs.globalStyles, { from: undefined });
  writeCached(directory, file, css);

  return css;
}

/**
 * Compiles the app's own `tailwind.config.js` and `global.css` for the class names given, the way
 * Metro does for Android, so a test sees the styles NativeWind would resolve on a device. It reads
 * `global.css` from the working directory, which is the app folder when Jest runs from there.
 */
export async function compileAppStyles(classNames: string): Promise<string> {
  return compileStylesWithCache({ classNames, globalStyles: readFileSync("global.css", "utf8") });
}

/** Hands the compiled styles to NativeWind's runtime. Call it in `beforeEach`, because the runtime resets between tests. */
export function registerAppStyles(css: string): void {
  registerCSS(css, cssToReactNativeRuntimeOptions);
  setupAllComponents();
}
