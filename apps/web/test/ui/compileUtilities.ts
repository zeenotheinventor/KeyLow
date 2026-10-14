import postcss from "postcss";
import tailwindcss from "tailwindcss";

import tailwindConfig from "../../tailwind.config";

/**
 * The CSS Tailwind generates for the classes in some markup, using the app's own config. jsdom
 * cannot evaluate media queries, so a test reads the generated CSS to prove a class is emitted
 * inside the media query it names.
 */
export async function compileUtilities(markup: string): Promise<string> {
  const result = await postcss([
    tailwindcss({ ...tailwindConfig, content: [{ raw: markup, extension: "html" }] }),
  ]).process("@tailwind utilities;", { from: undefined });
  return result.css;
}

/** The body of the first `@media (prefers-reduced-motion: reduce)` block that mentions `selector`. */
export function reducedMotionRules(css: string, selector: string): string {
  const blocks = css.split("@media (prefers-reduced-motion: reduce)").slice(1);
  return blocks.find((block) => block.includes(selector)) ?? "";
}
