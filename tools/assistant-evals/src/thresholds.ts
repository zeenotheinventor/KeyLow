// The pass rates a run must reach, from ADR 0006 ("Evals") and KEY-185 scope 7. Whole percentages, so the
// comparison with a count of cases is exact integer arithmetic.

export const EVAL_SET_NAMES = [
  "ask",
  "describe",
  "redTeam",
  "compaction",
  "writes",
  "recipes",
  "trainingAdvice",
] as const;

export type EvalSetName = (typeof EVAL_SET_NAMES)[number];

export const THRESHOLD_PERCENT: Readonly<Record<EvalSetName, number>> = {
  /** Ask your data. */
  ask: 90,
  /** Describe to log, first pass. */
  describe: 80,
  /** The red-team set. */
  redTeam: 100,
  /** Compaction (KEY-706): one case, so it passes or it does not. */
  compaction: 100,
  /** Writes (KEY-700): every write, Undo and never-repeated case passes. */
  writes: 100,
  /** Recipe import (KEY-701). Zee may change it on review. */
  recipes: 90,
  /** Training advice (KEY-895). Decides whether the assistant stays on its model (ruling 3 of KEY-881). */
  trainingAdvice: 90,
};
