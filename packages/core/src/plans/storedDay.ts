import type { LivePlan } from "./planOverlap";

/**
 * Which day `replan_day` replans: the day with something planned on it on that date, found among the live
 * plans. A date has one owner, so a day left empty in an older plan is not one. A confirmed day is refused,
 * because it is a record of what was written to the diary.
 */
export const dayToReplan = (
  plans: readonly LivePlan[],
  localDate: string,
): { status: "found"; planId: string; dayId: string } | { status: "not_planned" | "confirmed" } => {
  const held = plans.flatMap(({ id, days }) =>
    days
      .filter((day) => day.localDate === localDate && day.itemCount > 0)
      .map((day) => ({ planId: id, dayId: day.id, isConfirmed: day.isConfirmed })),
  );
  const owner = held.at(-1);
  if (owner === undefined) {
    return { status: "not_planned" };
  }
  return owner.isConfirmed
    ? { status: "confirmed" }
    : { status: "found", planId: owner.planId, dayId: owner.dayId };
};

/** What a day's items are, as a stored item and an item to write both say it. */
export type FingerprintItem = { position: number; slotTime: string | null } & (
  | { kind: "recipe"; recipeId: string | null; servings: number }
  | { kind: "food"; foodId: string | null; grams: number }
);

/**
 * A text that says what a day holds: each item's place, time, food or recipe and amount, and never its id or its
 * link to a cook. A day read back from the database and the items written to it give the same text, so Undo
 * can tell whether the day changed since the assistant left it.
 */
export const dayFingerprint = (items: readonly FingerprintItem[]): string =>
  JSON.stringify(
    [...items]
      .sort((first, second) => first.position - second.position)
      .map((item) => [
        item.position,
        item.slotTime?.slice(0, 5) ?? null,
        item.kind,
        item.kind === "recipe" ? item.recipeId : item.foodId,
        item.kind === "recipe" ? item.servings : item.grams,
      ]),
  );

export type CurrentDay = { id: string; isConfirmed: boolean; items: readonly FingerprintItem[] };

/**
 * Whether Undo may put a replanned day back: the day is there, is not confirmed, and holds what the replan
 * left. A day that was confirmed or edited since is not put back over.
 */
export const replanUndoState = (
  day: CurrentDay | undefined,
  fingerprint: string,
): "ready" | "gone" | "confirmed" | "changed" => {
  if (day === undefined) {
    return "gone";
  }
  if (day.isConfirmed) {
    return "confirmed";
  }
  return dayFingerprint(day.items) === fingerprint ? "ready" : "changed";
};

/**
 * The days a replan rewrote only to keep their leftover links, which Undo rewrites again. A day is left alone
 * when it is confirmed, or no longer holds what it held, because Undo never writes over a change.
 */
export const relinkedDaysToRestore = <
  Saved extends { dayId: string; items: readonly FingerprintItem[] },
>(
  saved: readonly Saved[],
  current: readonly CurrentDay[],
): Saved[] =>
  saved.filter(({ dayId, items }) => {
    const day = current.find(({ id }) => id === dayId);
    return (
      day !== undefined && !day.isConfirmed && dayFingerprint(day.items) === dayFingerprint(items)
    );
  });
