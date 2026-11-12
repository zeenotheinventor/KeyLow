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

/**
 * A per-tab mark that a recalculation has been saved. The browser's Back would otherwise reopen the wizard on
 * an answered step, so a recalculation address that finds the mark sends itself on to Targets. Targets'
 * Estimate my targets (the Targets row and the programme page's Start) clears it as it opens a new
 * recalculation. Step 1 cannot clear it, since it is also where the browser's Back ends. A way in that skips
 * those links, such as a middle click, can leave a stale mark: that only sends the person to Targets, where
 * the next press clears it, so it fails safe. Every read and write is guarded: with no
 * storage (a private window, blocked site data) the page behaves as it did before, and no mark is ever found.
 */
const RECALCULATION_SAVED_KEY = "keylow.setup.recalculationSaved";

/** Marks this tab's recalculation as saved. */
export function rememberRecalculationSaved(): void {
  try {
    window.sessionStorage.setItem(RECALCULATION_SAVED_KEY, "1");
  } catch {
    // No storage: the page behaves as it did before.
  }
}

/** Clears the mark, as a new recalculation opens. */
export function forgetRecalculationSaved(): void {
  try {
    window.sessionStorage.removeItem(RECALCULATION_SAVED_KEY);
  } catch {
    // No storage: there is no mark to clear.
  }
}

/** Whether this tab has saved a recalculation that no new one has followed. */
export function wasRecalculationSaved(): boolean {
  try {
    return window.sessionStorage.getItem(RECALCULATION_SAVED_KEY) === "1";
  } catch {
    return false;
  }
}
