/**
 * The coarse groups the palate sorts foods into, in the order the screen and the summary list them.
 * The words are the ones a sentence uses ("You rarely or never log sweets and snacks") and the label a
 * "Not true" correction on a group stores, so they are stable.
 */
export const PALATE_GROUPS = [
  "meat",
  "fish",
  "eggs",
  "dairy",
  "grains and bread",
  "potatoes",
  "vegetables",
  "fruit",
  "legumes and nuts",
  "fats and oils",
  "sweets and snacks",
  "drinks",
  "other",
] as const;

export type PalateGroup = (typeof PALATE_GROUPS)[number];

/** The groups that can be rarely or never logged. "Other" is a leftover, so it is never listed. */
export const PALATE_RARE_CANDIDATE_GROUPS: readonly PalateGroup[] = PALATE_GROUPS.filter(
  (group) => group !== "other",
);
