import { createRequire } from "node:module";

import { beforeAll } from "vitest";

import type { Config } from "tailwindcss";

type Tailwind = (config: Config) => unknown;
type Postcss = (plugins: unknown[]) => {
  process: (css: string, options: { from: undefined }) => Promise<{ css: string }>;
};

// Both packages are loaded without types, so these only check that the export is callable.
const isTailwind = (value: unknown): value is Tailwind => typeof value === "function";
const isPostcss = (value: unknown): value is Postcss => typeof value === "function";

const requireFromHere = createRequire(import.meta.url);

/** Loads postcss the way tailwindcss does, because the package does not depend on it directly. */
const loadPostcss = (): Postcss => {
  const requireFromTailwind = createRequire(requireFromHere.resolve("tailwindcss"));
  const postcss: unknown = requireFromTailwind("postcss");
  if (!isPostcss(postcss)) throw new Error("postcss did not load as a function");
  return postcss;
};

const loadTailwind = (): Tailwind => {
  const tailwind: unknown = requireFromHere("tailwindcss");
  if (!isTailwind(tailwind)) throw new Error("tailwindcss did not load as a function");
  return tailwind;
};

/** Runs Tailwind's real engine over the given classes and returns the CSS it generates. */
export const renderCss = async (
  config: Omit<Config, "content">,
  classNames: string[],
  stylesheet = "@tailwind utilities;",
): Promise<string> => {
  const tailwind = loadTailwind();
  const result = await loadPostcss()([
    tailwind({ ...config, content: [{ raw: classNames.join(" "), extension: "html" }] }),
  ]).process(stylesheet, { from: undefined });
  return result.css;
};

const WARM_UP_TIMEOUT_MILLISECONDS = 60_000;

/**
 * Registers a hook that pays Tailwind's one-off cold start (loading the engine and building its first context)
 * before the file's tests run, with a budget of its own. Without it the first test that renders CSS absorbs that cost
 * and timed out at 5s on a busy CI runner, where the cold start took 12s. Call it once at the top of a test file.
 */
export const warmUpTailwindBeforeAll = (): void => {
  beforeAll(async () => {
    await renderCss({}, ["block"]);
  }, WARM_UP_TIMEOUT_MILLISECONDS);
};
