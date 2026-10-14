/** The folders the guard reads. Anything else in the repository is not source the apps ship. */
export const scannedRoots = ["apps", "packages"];

/** Folders that hold installed or built files, which the guard never enters. */
export const ignoredDirectories = new Set([
  "node_modules",
  ".next",
  ".turbo",
  ".expo",
  ".git",
  "dist",
  "build",
  "coverage",
  "storybook-static",
]);

const scriptExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];

export const isScriptPath = (path: string): boolean =>
  scriptExtensions.some((extension) => path.endsWith(extension));

export const isStylesheetPath = (path: string): boolean => path.endsWith(".css");

const testDirectories = new Set(["test", "tests", "__tests__", "e2e"]);

const isTestPath = (path: string): boolean =>
  path.split("/").some((segment) => testDirectories.has(segment)) ||
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);

// `bundle-core-for-deno` copies core into the edge functions. It is a build product that git ignores.
const isBuiltCopyOfCore = (path: string): boolean => path.includes("/_shared/core/");

/** True for a source file the rules apply to: a script or a stylesheet that is not a test. */
export const isGuardedPath = (path: string): boolean =>
  (isScriptPath(path) || isStylesheetPath(path)) && !isTestPath(path) && !isBuiltCopyOfCore(path);
