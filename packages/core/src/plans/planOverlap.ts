/*
 * The overlap rule of a new plan (ADR 0003, Amendment 24, and `kitchen-plan.md`): a date is owned by one live
 * plan. A confirmed date is a record of what was written to the diary, so it is never planned again. The
 * unconfirmed days of an older plan that the new plan covers are cleared, and an older plan left with nothing in
 * it is archived. These functions choose the days. The tool does the writes.
 *
 * Clearing a cook day also nulls `leftover_of` on later leftovers of the older plan that lie outside the new
 * plan's days, because the database sets it null when the cooking item is deleted. That is accepted: such a
 * leftover stays a planned item, it only stops saying where it was cooked. Undo does not restore those leftover
 * links either: it puts back the cleared days and the links within them, and a link nulled outside them stays null.
 */

export type LivePlanDay = {
  id: string;
  localDate: string;
  isConfirmed: boolean;
  itemCount: number;
};

export type LivePlan = { id: string; days: readonly LivePlanDay[] };

/**
 * The days a new plan can cover out of the days asked for, and the ones it leaves out. A confirmed day is never
 * planned, and a plan is a run of consecutive days, so the plan is the first run of days that are not confirmed.
 */
export const planDatesAround = (
  requested: readonly string[],
  plans: readonly LivePlan[],
): { dates: string[]; leftOut: string[] } => {
  const confirmed = new Set(
    plans.flatMap(({ days }) =>
      days.filter(({ isConfirmed }) => isConfirmed).map(({ localDate }) => localDate),
    ),
  );
  const firstFree = requested.findIndex((date) => !confirmed.has(date));
  if (firstFree === -1) {
    return { dates: [], leftOut: [...requested] };
  }
  const lastFree = requested.findIndex((date, at) => at > firstFree && confirmed.has(date));
  const dates = requested.slice(firstFree, lastFree === -1 ? requested.length : lastFree);
  return { dates, leftOut: requested.filter((date) => !dates.includes(date)) };
};

export type DayToClear = { planId: string; dayId: string; localDate: string };

/** The unconfirmed days of the live plans, with something planned on them, that the new plan's dates cover. */
export const daysToClear = (plans: readonly LivePlan[], dates: readonly string[]): DayToClear[] =>
  plans.flatMap((plan) =>
    plan.days
      .filter(
        ({ localDate, isConfirmed, itemCount }) =>
          !isConfirmed && itemCount > 0 && dates.includes(localDate),
      )
      .map(({ id, localDate }) => ({ planId: plan.id, dayId: id, localDate })),
  );

/**
 * The plans that were cleared and have nothing left: no confirmed day, and every day either cleared just now or
 * already empty.
 */
export const plansToArchive = (
  plans: readonly LivePlan[],
  clearedDayIds: ReadonlySet<string>,
): string[] =>
  plans
    .filter(
      ({ days }) =>
        days.some(({ id }) => clearedDayIds.has(id)) &&
        days.every(
          ({ id, isConfirmed, itemCount }) =>
            !isConfirmed && (clearedDayIds.has(id) || itemCount === 0),
        ),
    )
    .map(({ id }) => id);

export type ClearedDay = { dayId: string; localDate: string };

export type SkippedDay = ClearedDay & { reason: "date_taken" | "day_edited" };

/**
 * Which of the days a plan cleared Undo may put back. `livePlans` is read before the undone plan is archived,
 * and the undone plan itself does not count. A day is skipped when its date is planned in another live plan now
 * (a later plan took it over), or when the old day itself has items again (it was edited after it was cleared),
 * because putting it back would give a date two owners or overwrite the person's change.
 */
export const daysToRestore = (
  cleared: readonly ClearedDay[],
  livePlans: readonly LivePlan[],
  undonePlanId: string,
): { restore: ClearedDay[]; skipped: SkippedDay[] } => {
  const others = livePlans.filter(({ id }) => id !== undonePlanId).flatMap(({ days }) => days);
  const restore: ClearedDay[] = [];
  const skipped: SkippedDay[] = [];
  for (const day of cleared) {
    const held = others.filter(({ itemCount }) => itemCount > 0);
    if (held.some(({ id }) => id === day.dayId)) {
      skipped.push({ ...day, reason: "day_edited" });
    } else if (held.some(({ localDate }) => localDate === day.localDate)) {
      skipped.push({ ...day, reason: "date_taken" });
    } else {
      restore.push(day);
    }
  }
  return { restore, skipped };
};

/** Whether Undo may archive a plan: it is live and none of its days was confirmed into the diary. */
export const isPlanUndoable = (
  plan: { days: readonly { isConfirmed: boolean }[] } | undefined,
): boolean => plan !== undefined && plan.days.every(({ isConfirmed }) => !isConfirmed);

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type StoredPlanItem = {
  id: string;
  position: number;
  slotTime: string | null;
  nutrients: Record<string, Json>;
  snapshot: Record<string, Json>;
  /** The id of the item that cooked this one. */
  leftoverOf: string | null;
} & (
  | { kind: "recipe"; recipeId: string | null; servings: number }
  | { kind: "food"; foodId: string | null; grams: number; portionId: string | null }
);

export type StoredPlan = {
  days: readonly { id: string; localDate: string; items: readonly StoredPlanItem[] }[];
};

type RestoredCore = {
  position: number;
  slotTime: string | null;
  nutrients: Record<string, Json>;
  snapshot: Record<string, Json>;
} & (
  | { kind: "recipe"; recipeId: string; servings: number }
  | { kind: "food"; foodId: string; grams: number; portionId: string | null }
);

/** An item as `replaceMealPlanDay` takes it. */
export type RestoredItem = RestoredCore & { leftoverOf?: { localDate?: string; position: number } };

const withReference = (item: StoredPlanItem): RestoredCore | null => {
  const shared = {
    position: item.position,
    slotTime: item.slotTime,
    nutrients: item.nutrients,
    snapshot: item.snapshot,
  };
  if (item.kind === "recipe") {
    return item.recipeId === null
      ? null
      : { ...shared, kind: "recipe", recipeId: item.recipeId, servings: item.servings };
  }
  return item.foodId === null
    ? null
    : {
        ...shared,
        kind: "food",
        foodId: item.foodId,
        grams: item.grams,
        portionId: item.portionId,
      };
};

/**
 * The items of one day of a stored plan, as `replaceMealPlanDay` takes them back, so a cleared day can be put
 * back as it was. An item whose recipe or food is gone cannot be put back and is left out. A leftover names its
 * cook by day and position, and loses the link when the cook cannot be put back.
 */
export const restorableItemsOfDay = (plan: StoredPlan, dayId: string): RestoredItem[] => {
  const cookOf = new Map<string, { localDate: string; position: number }>();
  for (const day of plan.days) {
    for (const item of day.items.filter((candidate) => withReference(candidate) !== null)) {
      cookOf.set(item.id, { localDate: day.localDate, position: item.position });
    }
  }
  const day = plan.days.find(({ id }) => id === dayId);
  if (day === undefined) {
    return [];
  }
  return day.items.flatMap((item): RestoredItem[] => {
    const restored = withReference(item);
    if (restored === null) {
      return [];
    }
    const cook = item.leftoverOf === null ? undefined : cookOf.get(item.leftoverOf);
    if (cook === undefined) {
      return [restored];
    }
    const leftoverOf =
      cook.localDate === day.localDate
        ? { position: cook.position }
        : { localDate: cook.localDate, position: cook.position };
    return [{ ...restored, leftoverOf }];
  });
};
