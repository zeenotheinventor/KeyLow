import { compileUtilities } from "./compileUtilities";

// Reads how far an element's invisible `::after` reaches past its drawn edges, from the classes it
// carries, compiled with the app's own Tailwind config (jsdom cannot measure a box).

export type Reach = { top: number; right: number; bottom: number; left: number };

const remInPixels = 16;

export const pixelsOf = (cssLength: string): number =>
  cssLength.trim().endsWith("rem") ? parseFloat(cssLength) * remInPixels : parseFloat(cssLength);

const asCssSelector = (token: string): string =>
  `.${token.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`)}::after`;

export const asPattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The pixels the element's `::after` reaches past each of the element's drawn edges, from the classes that
 * begin with `prefix`. A pseudo element is placed from the padding box, inside the border, so an element with
 * a border passes its width and the reach is that much less than the inset.
 */
export async function reachOf(
  element: HTMLElement,
  prefix = "after:",
  borderWidth = 0,
): Promise<Reach> {
  const css = await compileUtilities(element.className);
  const reach: Reach = { top: 0, right: 0, bottom: 0, left: 0 };
  const sides = ["top", "right", "bottom", "left"] as const;

  for (const token of element.className.split(/\s+/)) {
    if (!token.startsWith(prefix) || !/inset|-(top|right|bottom|left)-/.test(token)) continue;
    const rule = new RegExp(`${asPattern(asCssSelector(token))}\\s*\\{([^}]*)\\}`).exec(css);
    for (const [, property, value] of (rule?.[1] ?? "").matchAll(
      /(top|right|bottom|left|inset)\s*:\s*([^;]+)/g,
    )) {
      for (const side of property === "inset" ? sides : sides.filter((name) => name === property)) {
        reach[side] = 0 - pixelsOf(value ?? "0") - borderWidth;
      }
    }
  }
  return reach;
}
