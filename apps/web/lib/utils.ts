import { fontSize } from "@keylow/tokens";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The design's type styles are named `text-body`, `text-caption` and so on. Unless told they are
// font sizes, tailwind-merge takes them for text colours and drops one of them next to a real
// colour such as `text-text-secondary`.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: Object.keys(fontSize) }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
