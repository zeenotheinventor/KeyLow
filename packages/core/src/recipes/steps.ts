/*
 * The instruction steps of a recipe: an ordered list of text, where the first element is step 1. Every
 * operation returns a new list and leaves the one it was given alone. An index outside the list throws a
 * `RangeError`, because the editors only ever pass an index they drew. A message states the rule and
 * never the text of a step, which is health data.
 */

const isPlace = (index: number, length: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < length;

const assertStepIndex = (steps: readonly string[], index: number): void => {
  if (!isPlace(index, steps.length)) {
    throw new RangeError("The step index must be a whole number within the list");
  }
};

/** Adds a step at `at`, which may be the length of the list, and at the end when it is left out. */
export const addStep = (
  steps: readonly string[],
  text: string,
  at: number = steps.length,
): string[] => {
  if (!isPlace(at, steps.length + 1)) {
    throw new RangeError(
      "The place for a new step must be a whole number within or at the end of the list",
    );
  }
  return [...steps.slice(0, at), text, ...steps.slice(at)];
};

/** Replaces the text of the step at `index`. */
export const editStep = (steps: readonly string[], index: number, text: string): string[] => {
  assertStepIndex(steps, index);
  return steps.map((step, place) => (place === index ? text : step));
};

/** Removes the step at `index`. */
export const removeStep = (steps: readonly string[], index: number): string[] => {
  assertStepIndex(steps, index);
  return steps.filter((_, place) => place !== index);
};

/**
 * Takes the step at `from` out and puts it back so that it ends up at `to`, and the steps between shift
 * by one place. It does not swap two steps. Moving a step to where it is changes nothing.
 */
export const moveStep = (steps: readonly string[], from: number, to: number): string[] => {
  assertStepIndex(steps, from);
  assertStepIndex(steps, to);
  const moved = steps.slice(from, from + 1);
  const remaining = steps.filter((_, place) => place !== from);
  return [...remaining.slice(0, to), ...moved, ...remaining.slice(to)];
};

/** Moves the step at `index` one place towards the start. The first step cannot move up. */
export const moveStepUp = (steps: readonly string[], index: number): string[] =>
  moveStep(steps, index, index - 1);

/** Moves the step at `index` one place towards the end. The last step cannot move down. */
export const moveStepDown = (steps: readonly string[], index: number): string[] =>
  moveStep(steps, index, index + 1);

/**
 * The steps as they are saved: each one trimmed, blank ones dropped, the order kept. The text inside a
 * step is never changed. The database refuses a blank step, so the editors drop them here (ADR 0003,
 * Amendment 8).
 */
export const normaliseSteps = (steps: readonly string[]): string[] =>
  steps.map((step) => step.trim()).filter((step) => step !== "");
