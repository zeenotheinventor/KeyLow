import { describe, expect, it } from "vitest";

import {
  addStep,
  editStep,
  moveStep,
  moveStepDown,
  moveStepUp,
  normaliseSteps,
  removeStep,
} from "../../src/recipes";

const frozen = (steps: string[]): readonly string[] => Object.freeze([...steps]);

describe("addStep", () => {
  it.each([
    { name: "to an empty list", steps: [], at: undefined, expected: ["new"] },
    {
      name: "at the end by default",
      steps: ["a", "b"],
      at: undefined,
      expected: ["a", "b", "new"],
    },
    { name: "at the start", steps: ["a", "b"], at: 0, expected: ["new", "a", "b"] },
    { name: "in the middle", steps: ["a", "b"], at: 1, expected: ["a", "new", "b"] },
    { name: "at the end by index", steps: ["a", "b"], at: 2, expected: ["a", "b", "new"] },
    { name: "to a list of one", steps: ["a"], at: 0, expected: ["new", "a"] },
  ])("should add a step $name", ({ steps, at, expected }) => {
    expect(addStep(frozen(steps), "new", at)).toEqual(expected);
  });

  it.each([-1, 3, 1.5, Number.NaN])("should throw a RangeError for the place %s", (at) => {
    expect(() => addStep(frozen(["a", "b"]), "new", at)).toThrow(RangeError);
  });

  it("should not change the list it was given", () => {
    const steps = frozen(["a", "b"]);

    const result = addStep(steps, "new", 1);

    expect(result).not.toBe(steps);
    expect(steps).toEqual(["a", "b"]);
  });

  it("should keep the text as it was typed", () => {
    expect(addStep([], "  spaced  ")).toEqual(["  spaced  "]);
  });
});

describe("editStep", () => {
  it.each([
    { name: "the first", steps: ["a", "b", "c"], index: 0, expected: ["new", "b", "c"] },
    { name: "the last", steps: ["a", "b", "c"], index: 2, expected: ["a", "b", "new"] },
    { name: "the only", steps: ["a"], index: 0, expected: ["new"] },
    { name: "a middle", steps: ["a", "b", "c"], index: 1, expected: ["a", "new", "c"] },
  ])("should replace $name step", ({ steps, index, expected }) => {
    expect(editStep(frozen(steps), index, "new")).toEqual(expected);
  });

  it.each([
    { name: "an empty list", steps: [], index: 0 },
    { name: "a negative index", steps: ["a"], index: -1 },
    { name: "one past the end", steps: ["a"], index: 1 },
    { name: "a fraction", steps: ["a", "b"], index: 0.5 },
    { name: "NaN", steps: ["a"], index: Number.NaN },
  ])("should throw a RangeError for $name", ({ steps, index }) => {
    expect(() => editStep(frozen(steps), index, "new")).toThrow(RangeError);
  });

  it("should not change the list it was given", () => {
    const steps = frozen(["a", "b"]);

    editStep(steps, 0, "new");

    expect(steps).toEqual(["a", "b"]);
  });
});

describe("removeStep", () => {
  it.each([
    { name: "the first", steps: ["a", "b", "c"], index: 0, expected: ["b", "c"] },
    { name: "the last", steps: ["a", "b", "c"], index: 2, expected: ["a", "b"] },
    { name: "the only", steps: ["a"], index: 0, expected: [] },
    { name: "a middle", steps: ["a", "b", "c"], index: 1, expected: ["a", "c"] },
  ])("should remove $name step", ({ steps, index, expected }) => {
    expect(removeStep(frozen(steps), index)).toEqual(expected);
  });

  it.each([
    { name: "an empty list", steps: [], index: 0 },
    { name: "a negative index", steps: ["a"], index: -1 },
    { name: "one past the end", steps: ["a"], index: 1 },
    { name: "a fraction", steps: ["a", "b"], index: 1.5 },
  ])("should throw a RangeError for $name", ({ steps, index }) => {
    expect(() => removeStep(frozen(steps), index)).toThrow(RangeError);
  });

  it("should not change the list it was given", () => {
    const steps = frozen(["a", "b"]);

    removeStep(steps, 0);

    expect(steps).toEqual(["a", "b"]);
  });
});

describe("moveStep", () => {
  it.each([
    { name: "the first to the last", from: 0, to: 3, expected: ["b", "c", "d", "a"] },
    { name: "the last to the first", from: 3, to: 0, expected: ["d", "a", "b", "c"] },
    { name: "one place down", from: 1, to: 2, expected: ["a", "c", "b", "d"] },
    { name: "one place up", from: 2, to: 1, expected: ["a", "c", "b", "d"] },
    {
      name: "two places down, shifting the ones between",
      from: 0,
      to: 2,
      expected: ["b", "c", "a", "d"],
    },
    { name: "to where it already is", from: 2, to: 2, expected: ["a", "b", "c", "d"] },
  ])("should move $name", ({ from, to, expected }) => {
    expect(moveStep(frozen(["a", "b", "c", "d"]), from, to)).toEqual(expected);
  });

  it("should leave a list of one as it is", () => {
    expect(moveStep(frozen(["a"]), 0, 0)).toEqual(["a"]);
  });

  it.each([
    { name: "an empty list", steps: [], from: 0, to: 0 },
    { name: "a negative start", steps: ["a", "b"], from: -1, to: 0 },
    { name: "a start past the end", steps: ["a", "b"], from: 2, to: 0 },
    { name: "a negative target", steps: ["a", "b"], from: 0, to: -1 },
    { name: "a target past the end", steps: ["a", "b"], from: 0, to: 2 },
    { name: "a fractional target", steps: ["a", "b"], from: 0, to: 0.5 },
  ])("should throw a RangeError for $name", ({ steps, from, to }) => {
    expect(() => moveStep(frozen(steps), from, to)).toThrow(RangeError);
  });

  it("should not change the list it was given", () => {
    const steps = frozen(["a", "b", "c"]);

    moveStep(steps, 0, 2);

    expect(steps).toEqual(["a", "b", "c"]);
  });
});

describe("moveStepUp and moveStepDown", () => {
  it("should move a step one place up", () => {
    expect(moveStepUp(frozen(["a", "b", "c"]), 2)).toEqual(["a", "c", "b"]);
  });

  it("should move a step one place down", () => {
    expect(moveStepDown(frozen(["a", "b", "c"]), 0)).toEqual(["b", "a", "c"]);
  });

  it("should throw a RangeError for the first step moved up", () => {
    expect(() => moveStepUp(frozen(["a", "b"]), 0)).toThrow(RangeError);
  });

  it("should throw a RangeError for the last step moved down", () => {
    expect(() => moveStepDown(frozen(["a", "b"]), 1)).toThrow(RangeError);
  });
});

describe("normaliseSteps", () => {
  it.each([
    { name: "an empty list", steps: [], expected: [] },
    { name: "steps that need nothing", steps: ["a", "b"], expected: ["a", "b"] },
    { name: "spaces around a step", steps: ["  a  ", "\tb\n"], expected: ["a", "b"] },
    { name: "blank steps", steps: ["a", "", "   ", "\n\t", "b"], expected: ["a", "b"] },
    { name: "only blank steps", steps: ["", " "], expected: [] },
    { name: "the spaces inside a step", steps: [" a   b \n c "], expected: ["a   b \n c"] },
  ])("should handle $name", ({ steps, expected }) => {
    expect(normaliseSteps(frozen(steps))).toEqual(expected);
  });

  it("should not change the list it was given", () => {
    const steps = frozen(["  a ", ""]);

    normaliseSteps(steps);

    expect(steps).toEqual(["  a ", ""]);
  });
});

describe("what an error says", () => {
  it("should never quote the text of a step", () => {
    const secret = "eat only 1200 calories a day";
    const failures = [
      () => addStep([secret], secret, 5),
      () => editStep([secret], 5, secret),
      () => removeStep([secret], 5),
      () => moveStep([secret], 0, 5),
      () => moveStepUp([secret], 0),
    ];

    for (const fail of failures) {
      expect(fail).toThrow(RangeError);
      expect(fail).not.toThrow(/1200|calories/);
    }
  });
});
