import { createRequire } from "node:module";

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
