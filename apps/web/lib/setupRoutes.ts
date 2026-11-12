import { isStepComplete, nextStep, SETUP_STEPS } from "@keylow/core/setup";

import type { SetupDraft, SetupStep } from "@keylow/core/setup";

/**
 * How the wizard was opened. `first-run` is a new account's setup, and `recalculate` is an existing
 * account's, opened from Targets, which adds Close to every step.
 */
export type SetupMode = "first-run" | "recalculate";

/**
 * The wizard's mode from the `mode` search parameter. Only an exact `first-run` is the first run, so a
 * mistyped or missing parameter opens the recalculation, which has Close and so can never trap the person.
 */
export function readSetupMode(parameter: string | string[] | undefined): SetupMode {
  return parameter === "first-run" ? "first-run" : "recalculate";
}

/** The first step has the wizard's own address, so `/setup?mode=first-run` stays the address the gate sends to. */
const SETUP_ROOT = "/setup";

/** The wizard's folder, which More is current on in both modes. */
export const setupRootPath = (): string => SETUP_ROOT;

// `birthDate` is addressed as `birth-date`. The address is the step's name from core, and a number would
// change its meaning, because the rate step comes and goes with the goal.
const segmentOf = (step: SetupStep): string =>
  step.replace(/[A-Z]/g, (capital) => `-${capital.toLowerCase()}`);

/** A step's address. The mode is carried on every one, so a step opened cold or by the browser's Back keeps it. */
export const setupPath = (step: SetupStep, mode: SetupMode): string =>
  `${step === "sex" ? SETUP_ROOT : `${SETUP_ROOT}/${segmentOf(step)}`}?mode=${mode}`;

/**
 * The step a `/setup/[step]` segment names, or `undefined` for anything else. The first step has no segment,
 * since `/setup` is its address.
 */
export function readSetupStep(segment: string): SetupStep | undefined {
  return SETUP_STEPS.find((step) => step !== "sex" && segmentOf(step) === segment);
}

/** Where Close leaves for: the Targets page the recalculation was opened from. */
export const setupExitPath = (): string => "/more/targets";

/**
 * The step an address must be sent to, or `undefined` when it can stay. An address whose earlier steps are
 * unanswered goes to the first of them, which also stops the estimate on an empty draft, and the rate address
 * of a Maintain goal goes on to the step after it. The reducer accepts any step it is told of, so this is
 * the page's check.
 */
export function stepToRedirectTo(
  draft: SetupDraft,
  step: SetupStep,
  today: string,
): SetupStep | undefined {
  const isSkipped = step === "rate" && draft.goal === "maintain";
  const shownBefore = SETUP_STEPS.slice(0, SETUP_STEPS.indexOf(step)).filter(
    (earlier) => !(earlier === "rate" && draft.goal === "maintain"),
  );
  return (
    shownBefore.find((earlier) => !isStepComplete(draft, earlier, today)) ??
    (isSkipped ? nextStep(draft, step) : undefined)
  );
}
