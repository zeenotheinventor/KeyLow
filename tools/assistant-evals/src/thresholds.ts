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
  "trainingEdits",
  "trainingKnowledge",
  "mealEstimate",
  "featureRequest",
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
  /** Training edits (KEY-911): every training write, its Undo and the questions around them. Zee accepted 90 on 2026-11-07. */
  trainingEdits: 90,
  /** General training knowledge (KEY-952): general weightlifting questions answered from general knowledge, and a pain case that refers. */
  trainingKnowledge: 90,
  /** Described meals logged from estimate_portions (KEY-966). Its own set so it can be dispatched alone, under the 300,000 token budget of a run. */
  mealEstimate: 80,
  /** The assistant offers a feature request when Ki-Lo has no such feature, and sends it only on the button (KEY-977). */
  featureRequest: 90,
};

/**
 * The sets a run with no `--set` leaves out, because they would take it past the 300,000 token budget the other
 * sets share, or because they are run on demand (KEY-952, KEY-966, KEY-977). They run when named (`--set trainingEdits`), as the
 * workflow's `sets` input does.
 */
export const OPT_IN_SET_NAMES: readonly EvalSetName[] = [
  "trainingEdits",
  "trainingKnowledge",
  "mealEstimate",
  "featureRequest",
];
