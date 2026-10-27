import { BODY_ARTWORK, isMuscleId } from "@keylow/core/training";
import { bodyMapPalette } from "@keylow/tokens";

import type { BodyArtworkFigure, BodyArtworkSide, MuscleId } from "@keylow/core/training";
import type { ThemeScheme } from "@keylow/tokens";
import type { screen } from "@testing-library/react-native";

type FigureElement = ReturnType<typeof screen.getByRole>;

// A host node's props are loosely typed, so a prop is read with a descriptor.
function propOf(props: object, name: string): unknown {
  return Object.getOwnPropertyDescriptor(props, name)?.value;
}

// How react-native-svg holds a colour once it has read it: an opaque ARGB number.
function paint(hex: string) {
  return { type: 0, payload: 0xff000000 + parseInt(hex.slice(1), 16) };
}

/**
 * The fill of every muscle drawn in a figure, read from the figure found by its accessible name. A muscle
 * has no role of its own, so its drawing is found by its path on the side the figure shows, in the body
 * drawn (the male, unless said).
 */
export function fillsIn(
  figure: FigureElement,
  side: BodyArtworkSide,
  body: BodyArtworkFigure = "male",
): Map<MuscleId, unknown> {
  const fills = new Map<MuscleId, unknown>();
  for (const [id, path] of Object.entries(BODY_ARTWORK[body][side].muscles)) {
    const [drawing] = figure.queryAll(
      (node) => node.type === "RNSVGPath" && propOf(node.props, "d") === path,
    );
    if (isMuscleId(id) && drawing !== undefined) {
      fills.set(id, propOf(drawing.props, "fill"));
    }
  }
  return fills;
}

/** The fill a heat step is drawn with, as react-native-svg holds it, for the scheme. */
export function heatFill(scheme: ThemeScheme, step: number) {
  const hex = bodyMapPalette(scheme).heat[step];
  if (hex === undefined) {
    throw new RangeError("A heat step must be a whole number from 0 to 5");
  }
  return paint(hex);
}

/** The fill a volume status (an index in core's `VOLUME_STATUSES`) is drawn with, as react-native-svg holds it. */
export function volumeFill(scheme: ThemeScheme, status: number) {
  const { notTrained, maintaining, growing, productive, high } = bodyMapPalette(scheme).volume;
  const hex = [notTrained, maintaining, growing, productive, high][status];
  if (hex === undefined) {
    throw new RangeError("A volume status must be a whole number from 0 to 4");
  }
  return paint(hex);
}

/** The fill a gap value (an index in core's `GAP_VALUES`) is drawn with, as react-native-svg holds it. */
export function gapFill(scheme: ThemeScheme, value: number) {
  const { behind, onPlan, ahead, notInPlan } = bodyMapPalette(scheme).gap;
  const hex = [behind, onPlan, ahead, notInPlan][value];
  if (hex === undefined) {
    throw new RangeError("A gap value must be a whole number from 0 to 3");
  }
  return paint(hex);
}
