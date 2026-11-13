import type { PalateAvoidItem, PalatePreference } from "./types";

/**
 * What the person said they avoid: allergies first, then dislikes, each in the order given. A word is
 * listed once, so one on the list under both kinds is the allergy. The "not true" corrections are not
 * foods to avoid, and a blank label is no food.
 */
export function listAvoidedFoods(preferences: readonly PalatePreference[]): PalateAvoidItem[] {
  const items = preferences.flatMap((preference): PalateAvoidItem[] => {
    // A dislike or an allergy with no label fits the type, so it is guarded here. A union that ties each kind
    // to its fields would change the `PalatePreference` type that other lanes read, so the type is left alone.
    const label = (preference.label ?? "").trim();
    return label !== "" && (preference.kind === "allergy" || preference.kind === "dislike")
      ? [{ preferenceId: preference.id, label, kind: preference.kind }]
      : [];
  });
  const allergies = items.filter(({ kind }) => kind === "allergy");
  const dislikes = items.filter(({ kind }) => kind === "dislike");
  const seen = new Set<string>();
  return [...allergies, ...dislikes].filter(({ label }) => {
    const key = label.toLowerCase();
    return seen.has(key) ? false : Boolean(seen.add(key));
  });
}

/**
 * The item on the list that a word is, under either kind, ignoring case and the spaces around it, or
 * undefined for a new word. Its kind says whether the person is adding the same thing twice or the other
 * kind of it. To change a dislike into an allergy the person removes it and adds it again.
 */
export function findAvoidedFood(
  preferences: readonly PalatePreference[],
  label: string,
): PalateAvoidItem | undefined {
  const word = label.trim().toLowerCase();
  return listAvoidedFoods(preferences).find((item) => item.label.toLowerCase() === word);
}
