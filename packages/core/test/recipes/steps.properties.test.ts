import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { addStep, editStep, moveStep, normaliseSteps, removeStep } from "../../src/recipes";

const stepText = fc.string({ maxLength: 20 });
const stepList = fc.array(stepText, { maxLength: 12 });
const nonEmptyStepList = fc.array(stepText, { minLength: 1, maxLength: 12 });

/** A list with two places in it, where a place is the index of one of its steps. */
const listWithTwoPlaces = nonEmptyStepList.chain((steps) =>
  fc.record({
    steps: fc.constant(steps),
    first: fc.nat(steps.length - 1),
    second: fc.nat(steps.length - 1),
  }),
);

describe("step operations", () => {
  it("should be undone by moving the step back", () => {
    fc.assert(
      fc.property(listWithTwoPlaces, ({ steps, first, second }) => {
        expect(moveStep(moveStep(steps, first, second), second, first)).toEqual(steps);
      }),
    );
  });

  it("should keep the same steps when one is moved, only the order changes", () => {
    fc.assert(
      fc.property(listWithTwoPlaces, ({ steps, first, second }) => {
        expect([...moveStep(steps, first, second)].sort()).toEqual([...steps].sort());
      }),
    );
  });

  it("should keep the other steps in their order when one is moved, which a swap does not", () => {
    fc.assert(
      fc.property(listWithTwoPlaces, ({ steps, first, second }) => {
        const withoutPlace = (list: readonly string[], place: number) =>
          list.filter((_, index) => index !== place);

        expect(withoutPlace(moveStep(steps, first, second), second)).toEqual(
          withoutPlace(steps, first),
        );
      }),
    );
  });

  it("should put the moved step at the place it was sent to", () => {
    fc.assert(
      fc.property(listWithTwoPlaces, ({ steps, first, second }) => {
        expect(moveStep(steps, first, second)[second]).toBe(steps[first]);
      }),
    );
  });

  it("should give back the original after adding a step and removing it from the same place", () => {
    fc.assert(
      fc.property(
        stepList.chain((steps) =>
          fc.record({ steps: fc.constant(steps), at: fc.nat(steps.length), text: stepText }),
        ),
        ({ steps, at, text }) => {
          expect(removeStep(addStep(steps, text, at), at)).toEqual(steps);
        },
      ),
    );
  });

  it("should leave the text of every step it did not name as it was", () => {
    fc.assert(
      fc.property(
        nonEmptyStepList.chain((steps) =>
          fc.record({ steps: fc.constant(steps), index: fc.nat(steps.length - 1), text: stepText }),
        ),
        ({ steps, index, text }) => {
          const edited = editStep(steps, index, text);
          const others = (list: readonly string[]) => list.filter((_, place) => place !== index);

          expect(edited[index]).toBe(text);
          expect(others(edited)).toEqual(others(steps));
        },
      ),
    );
  });

  it("should leave the text of the other steps as it was when one is removed", () => {
    fc.assert(
      fc.property(
        nonEmptyStepList.chain((steps) =>
          fc.record({ steps: fc.constant(steps), index: fc.nat(steps.length - 1) }),
        ),
        ({ steps, index }) => {
          expect(removeStep(steps, index)).toEqual(steps.filter((_, place) => place !== index));
        },
      ),
    );
  });
});

describe("normaliseSteps", () => {
  it("should give the same answer when run twice", () => {
    fc.assert(
      fc.property(stepList, (steps) => {
        const once = normaliseSteps(steps);

        expect(normaliseSteps(once)).toEqual(once);
      }),
    );
  });

  it("should keep the steps in their relative order", () => {
    fc.assert(
      fc.property(stepList, (steps) => {
        const expected = steps.map((step) => step.trim()).filter((step) => step !== "");

        expect(normaliseSteps(steps)).toEqual(expected);
      }),
    );
  });

  it("should never change the text inside a step", () => {
    fc.assert(
      fc.property(stepList, (steps) => {
        const original = new Set(steps.map((step) => step.trim()));

        for (const step of normaliseSteps(steps)) {
          expect(original.has(step)).toBe(true);
        }
      }),
    );
  });

  it("should leave no blank step and no step with a space at either end", () => {
    fc.assert(
      fc.property(stepList, (steps) => {
        for (const step of normaliseSteps(steps)) {
          expect(step).not.toBe("");
          expect(step).toBe(step.trim());
        }
      }),
    );
  });
});
