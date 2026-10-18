import type { EdgeErrorCode } from "@keylow/core/schemas";

/** An Edge Function refused the request because a rate limit was reached (HTTP 429). */
export class RateLimitedError extends Error {
  readonly retryAfterSeconds: number | undefined;

  constructor(message: string, retryAfterSeconds: number | undefined, cause: unknown) {
    super(message, { cause });
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** An Edge Function answered with a typed error body (see `edgeErrorSchema` in core). */
export class EdgeFunctionError extends Error {
  readonly code: EdgeErrorCode;
  readonly status: number;

  constructor(message: string, code: EdgeErrorCode, status: number, cause: unknown) {
    super(message, { cause });
    this.name = "EdgeFunctionError";
    this.code = code;
    this.status = status;
  }
}

/** Open Food Facts has no product with this barcode, so there is nothing to turn into a food. */
export class OffProductNotFoundError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Open Food Facts has no product with the barcode ${code}`);
    this.name = "OffProductNotFoundError";
    this.code = code;
  }
}

/**
 * What went wrong with an Edge Function call, with no sentence in it: one of the six codes an Edge
 * Function answers with, or `failed` when the failure was not a typed answer (no network, or a
 * body that was not an edge error). A screen turns a kind into words with `describeEdgeError`.
 */
export type EdgeErrorKind = EdgeErrorCode | "failed";

export function toEdgeErrorKind(error: Error): EdgeErrorKind {
  if (error instanceof RateLimitedError) {
    return "rate_limited";
  }

  return error instanceof EdgeFunctionError ? error.code : "failed";
}

/** The rules a routine write is refused by, as stable codes. The sentence for each is screen copy. */
export type RoutineRule = "active_routine";

/**
 * A routine write the database refused for a rule the screen can explain: today only archiving the
 * active routine, which the screen avoids by making another routine active first. The message names the
 * action and the rule and nothing from the routine, because routines are health data.
 */
export class RoutineRuleError extends Error {
  readonly rule: RoutineRule;

  constructor(action: string, rule: RoutineRule) {
    super(`Could not ${action} (${rule})`, { cause: { code: rule } });
    this.name = "RoutineRuleError";
    this.rule = rule;
  }
}

/** The rules an exercise write is refused by, as stable codes. The sentence for each is screen copy. */
export type ExerciseRule = "global_exercise";

/**
 * An exercise write the database refused for a rule the screen can explain: today only editing or
 * archiving an exercise of the library, which is no one's to change. The screen avoids it by offering
 * Edit and Archive on the user's own exercises only. The message names the action and the rule and
 * nothing from the exercise, because an exercise's name and muscles are health data.
 */
export class ExerciseRuleError extends Error {
  readonly rule: ExerciseRule;

  constructor(action: string, rule: ExerciseRule) {
    super(`Could not ${action} (${rule})`, { cause: { code: rule } });
    this.name = "ExerciseRuleError";
    this.rule = rule;
  }
}
