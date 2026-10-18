import { BODY_ARTWORK } from "@keylow/core/training";

import { figureHeightOf, hitBoxes } from "./hitBoxes";

import type { HitBox } from "./hitBoxes";
import type { BodyArtworkFigure, BodyArtworkSide, MuscleId } from "@keylow/core/training";

const figures: BodyArtworkFigure[] = ["male", "female"];
const sides: BodyArtworkSide[] = ["front", "back"];
const figureSides = figures.flatMap((figure) => sides.map((side) => ({ figure, side })));
const thinMuscles: MuscleId[] = ["neck", "forearms", "tibialis"];
// The artwork draws these over one another, so a neighbour's box covers the middle of theirs. They keep a
// smaller share, which the share test pins instead.
const overlappedMuscles: MuscleId[] = ["delt_side", "traps_mid", "glute_med"];

function boxesOf(boxes: HitBox[], muscle: MuscleId): HitBox[] {
  return boxes.filter((box) => box.muscle === muscle);
}

describe("the artwork the hit boxes are read from", () => {
  it.each(figureSides)(
    "should hold only absolute move, line, curve and close commands on the $figure $side",
    ({ figure, side }) => {
      const letters = Object.values(BODY_ARTWORK[figure][side].muscles).flatMap(
        (path) => path.match(/[A-Za-z]/g) ?? [],
      );

      expect(letters.filter((letter) => !"MLCQZ".includes(letter))).toEqual([]);
    },
  );
});

describe("figureHeightOf", () => {
  it("should follow the 200 by 440 drawing", () => {
    expect(figureHeightOf(100)).toBe(220);
  });
});

describe("hitBoxes", () => {
  it("should give every muscle of the side a box", () => {
    const muscles = hitBoxes("front", "male", 120).map((box) => box.muscle);

    expect(new Set(muscles)).toEqual(new Set(Object.keys(BODY_ARTWORK.male.front.muscles)));
  });

  it("should read out each muscle once", () => {
    const readOut = hitBoxes("back", "male", 120)
      .filter((box) => box.isReadOut)
      .map((box) => box.muscle);

    expect([...readOut].sort()).toEqual(Object.keys(BODY_ARTWORK.male.back.muscles).sort());
  });

  it("should give the left and the right of a muscle a box each", () => {
    const [left, right, ...others] = boxesOf(hitBoxes("front", "male", 120), "delt_front");

    expect(others).toHaveLength(0);
    expect(left?.left).toBeLessThan(right?.left ?? 0);
  });

  it("should scale the boxes with the width", () => {
    const [small] = boxesOf(hitBoxes("front", "male", 100), "quads");
    const [large] = boxesOf(hitBoxes("front", "male", 200), "quads");

    expect(large?.width).toBeCloseTo((small?.width ?? 0) * 2);
    expect(large?.top).toBeCloseTo((small?.top ?? 0) * 2);
  });

  it("should leave a muscle that is not thin at the size it is drawn", () => {
    const abs = boxesOf(hitBoxes("front", "male", 120), "abs");

    expect(abs.length).toBeGreaterThan(0);
    abs.forEach((box) => {
      expect(box.width).toBeLessThan(44);
    });
  });

  describe.each(figureSides)("on the $figure $side", ({ figure, side }) => {
    it("should keep every box inside the figure, where a touch can reach it", () => {
      hitBoxes(side, figure, 120).forEach((box) => {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.left + box.width).toBeLessThanOrEqual(120 + 1e-9);
        expect(box.top + box.height).toBeLessThanOrEqual(264 + 1e-9);
      });
    });

    describe.each([90, 120, 140])("at %i points wide", (width) => {
      const boxes = hitBoxes(side, figure, width);

      // The box drawn last is the one a touch lands on.
      const topmostAt = (x: number, y: number) =>
        boxes.findLast(
          (box) =>
            x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height,
        );

      // The share of a muscle's boxes, sampled on a grid, where a touch lands on the muscle itself.
      const reachableShare = (muscle: MuscleId) => {
        const samples = boxes
          .filter((box) => box.muscle === muscle)
          .flatMap((box) =>
            Array.from({ length: 100 }, (_, cell) => ({
              x: box.left + (((cell % 10) + 0.5) * box.width) / 10,
              y: box.top + ((Math.floor(cell / 10) + 0.5) * box.height) / 10,
            })),
          );
        return (
          samples.filter(({ x, y }) => topmostAt(x, y)?.muscle === muscle).length / samples.length
        );
      };

      const muscles = [...new Set(boxes.map((box) => box.muscle))];

      it.each(muscles.filter((muscle) => !overlappedMuscles.includes(muscle)))(
        "should let the middle of one box of %s reach the muscle",
        (muscle) => {
          const reachesItself = boxes
            .filter((box) => box.muscle === muscle)
            .some(
              (box) =>
                topmostAt(box.left + box.width / 2, box.top + box.height / 2)?.muscle === muscle,
            );

          expect(reachesItself).toBe(true);
        },
      );

      it.each(muscles)(
        "should leave at least a quarter of the %s boxes to the muscle",
        (muscle) => {
          expect(reachableShare(muscle)).toBeGreaterThanOrEqual(0.25);
        },
      );
    });
  });
  describe.each(figures)("on the %s front, which has the thin muscles", (figure) => {
    it.each([120, 150, 200])(
      "should give a thin muscle a box of at least 44 points each way at %i points wide",
      (width) => {
        const boxes = hitBoxes("front", figure, width).filter((box) =>
          thinMuscles.includes(box.muscle),
        );

        expect(new Set(boxes.map((box) => box.muscle))).toEqual(new Set(thinMuscles));
        boxes.forEach((box) => {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        });
      },
    );
  });
});
