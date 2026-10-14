import { useCappedLineHeight } from "../../../../lib/useCappedLineHeight";

// The design's line box for a tab label, and how far the label may grow at large text.
const labelLineHeight = 12;
const maxFontScale = 1.2;

/** The line height to give a tab label: the design's 12 points, grown only as far as the label's font is allowed to. */
export function useLabelLineHeight(): number {
  return useCappedLineHeight(labelLineHeight, maxFontScale);
}
