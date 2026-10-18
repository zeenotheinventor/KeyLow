import { BODY_ARTWORK, isMuscleId } from "@keylow/core/training";

import type { BodyArtworkFigure, BodyArtworkSide, MuscleId } from "@keylow/core/training";

/*
 * The places a touch lands on the figure. The artwork has no hit shapes, so each part of each muscle
 * (its left and its right, or one plate of the abs) gets the box its drawing fills, in points. The
 * box is read from the path's control points, which only ever lie outside the curve, so it is a little
 * generous and never misses the muscle.
 */

/** The smallest side of a thing to touch, in points. */
export const MINIMUM_TARGET_POINTS = 44;

const VIEW_BOX_WIDTH = 200;
const VIEW_BOX_HEIGHT = 440;

/** The muscles too thin to touch at their drawn size, so their boxes grow to the minimum target. */
const THIN_MUSCLES: ReadonlySet<MuscleId> = new Set(["neck", "forearms", "tibialis"]);

/** The height in points of a figure that is `width` points wide, from the 200 by 440 drawing. */
export function figureHeightOf(width: number): number {
  return (width * VIEW_BOX_HEIGHT) / VIEW_BOX_WIDTH;
}

export type HitBox = {
  muscle: MuscleId;
  left: number;
  top: number;
  width: number;
  height: number;
  /** True for one box of each muscle, the one a screen reader reaches. The other box of a muscle is the same button. */
  isReadOut: boolean;
};

type Span = { start: number; size: number };

/** The span of the numbers, in the drawing's units. */
function spanOf(numbers: number[]): Span {
  const start = Math.min(...numbers);
  return { start, size: Math.max(...numbers) - start };
}

/** The part of a path that starts at each move command. The artwork uses absolute commands only, which a test pins. */
function partsOf(path: string): string[] {
  return path.split(/(?=M)/).filter((part) => part.trim() !== "");
}

/** The horizontal and vertical span of a part. With absolute commands only, every number is one half of a point. */
function spansOf(part: string): { horizontal: Span; vertical: Span } {
  const numbers = (part.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  return {
    horizontal: spanOf(numbers.filter((_, index) => index % 2 === 0)),
    vertical: spanOf(numbers.filter((_, index) => index % 2 === 1)),
  };
}

/** A span grown about its middle to the minimum target, and moved back inside the figure where it would stick out. */
function grown({ start, size }: Span, extent: number): Span {
  if (size >= MINIMUM_TARGET_POINTS) {
    return { start, size };
  }
  const grownSize = Math.min(MINIMUM_TARGET_POINTS, extent);
  const middle = start + size / 2;
  return {
    start: Math.max(0, Math.min(middle - grownSize / 2, extent - grownSize)),
    size: grownSize,
  };
}

/**
 * The hit boxes of one side of a figure at a width in points, in the order to draw them in: the thin ones first, then the rest in the order of the artwork. A grown box underneath only catches
 * the touches that no muscle's own box claims, so growing a thin muscle never steals a touch from a
 * neighbour.
 */
export function hitBoxes(side: BodyArtworkSide, body: BodyArtworkFigure, width: number): HitBox[] {
  const scale = width / VIEW_BOX_WIDTH;
  const height = figureHeightOf(width);

  const boxes = Object.entries(BODY_ARTWORK[body][side].muscles).flatMap(([id, path]) => {
    if (!isMuscleId(id)) {
      return [];
    }
    const isThin = THIN_MUSCLES.has(id);
    return partsOf(path).map((part, index): HitBox => {
      const { horizontal, vertical } = spansOf(part);
      const across = { start: horizontal.start * scale, size: horizontal.size * scale };
      const down = { start: vertical.start * scale, size: vertical.size * scale };
      const horizontalBox = isThin ? grown(across, width) : across;
      const verticalBox = isThin ? grown(down, height) : down;
      return {
        muscle: id,
        left: horizontalBox.start,
        top: verticalBox.start,
        width: horizontalBox.size,
        height: verticalBox.size,
        isReadOut: index === 0,
      };
    });
  });

  return [
    ...boxes.filter((box) => THIN_MUSCLES.has(box.muscle)),
    ...boxes.filter((box) => !THIN_MUSCLES.has(box.muscle)),
  ];
}
