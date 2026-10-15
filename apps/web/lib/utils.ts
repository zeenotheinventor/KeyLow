import { borderRadius, controlSizes, fontSize, scaleSteps } from "@keylow/tokens";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The design's type styles are named `text-body`, `text-caption` and so on. Unless told they are
// font sizes, tailwind-merge takes them for text colours and drops one of them next to a real
// colour such as `text-text-secondary`. Likewise the design's radii (`rounded-small` to
// `rounded-pill`) are not sizes it knows, so a later radius would not replace an earlier one. The
// same goes for the control sizes (`h-control-md`, `min-h-touch-target`) and `scale-press`: unless
// told, a screen's `h-11` would sit beside the kit's height instead of replacing it.
const controlSizeNames = Object.keys(controlSizes);

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: Object.keys(fontSize) }],
      rounded: [{ rounded: Object.keys(borderRadius) }],
      h: [{ h: controlSizeNames }],
      w: [{ w: controlSizeNames }],
      "min-h": [{ "min-h": controlSizeNames }],
      "min-w": [{ "min-w": controlSizeNames }],
      scale: [{ scale: Object.keys(scaleSteps) }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
// ci test, safe to delete
