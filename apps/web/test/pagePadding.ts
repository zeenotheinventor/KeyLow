import { compileUtilities } from "./ui/compileUtilities";

/** The top and bottom padding in pixels, as [top, bottom]. */
type VerticalPadding = readonly [top: number, bottom: number];

export type PagePadding = { phone: VerticalPadding; desktop: VerticalPadding };

function paddingIn(css: string): VerticalPadding {
  const pixels = (side: "top" | "bottom") =>
    Number(new RegExp(`padding-${side}:\\s*([\\d.]+)px`).exec(css)?.[1] ?? 0);
  return [pixels("top"), pixels("bottom")];
}

/**
 * The vertical padding Tailwind generates for an element's classes, in pixels. jsdom cannot
 * evaluate media queries, so the phone value is the CSS outside any media query and the desktop
 * value is the CSS inside the `lg` one. A side with no padding class reads as 0.
 */
export async function pagePaddingOf(element: Element | null): Promise<PagePadding> {
  const css = await compileUtilities(element?.getAttribute("class") ?? "");
  const mediaStart = css.indexOf("@media");
  const phoneCss = mediaStart === -1 ? css : css.slice(0, mediaStart);
  const desktopCss = mediaStart === -1 ? "" : css.slice(mediaStart);

  return { phone: paddingIn(phoneCss), desktop: paddingIn(desktopCss) };
}
