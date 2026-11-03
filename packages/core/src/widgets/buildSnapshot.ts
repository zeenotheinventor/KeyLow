import { EXERCISE_NAMES_LIMIT, RECENT_FOODS_LIMIT, WIDGET_SNAPSHOT_VERSION } from "./constants";
import { widgetSnapshotSchema } from "./snapshot";
import { weekDayTotals } from "../diary/rules/weekDayTotals";
import { nutrientsOfSnapshot } from "../diary/snapshotQuantity";
import { prefillNextSet } from "../training/prefill";

import type { WidgetSnapshot } from "./snapshot";
import type { WeekDayNutrients } from "../diary/rules/weekDayTotals";
import type { FoodSnapshot } from "../diary/schemas";
import type { DayOfWeekKcal } from "../engine/types";
import type { SetType } from "../training/enums";
import type { MuscleId } from "../training/muscles";
import type { LastPerformanceSet, PrefillSessionSet } from "../training/prefill";

/*
 * Builds the snapshot the app writes for the widgets (ADR 0007, "When the app writes the snapshot") from
 * plain data the screens already hold. Pure: `now` and the nonce are arguments. The result is checked
 * against the contract's schema, and a build that does not pass is null, so nothing malformed is stored.
 */

type WeekdayFigures = [number, number, number, number, number, number, number];

type SessionSnapshot = NonNullable<WidgetSnapshot["training"]["session"]>;

/** The next set the Training widget logs, as the snapshot holds it. */
export type WidgetNextSet = NonNullable<SessionSnapshot["next"]>;

export type WidgetSnapshotInput = Readonly<{
  /** A random value of at least `NONCE_MINIMUM_LENGTH` characters. */
  nonce: string;
  now: Date;
  timeZone: string;
  weightUnit: "kg" | "lb";
  /** The local day, `YYYY-MM-DD`. */
  today: string;
  /** The week's calories and macros as the Today card reads them, with the weekday figures of a programme. */
  targets: Readonly<{
    kcal: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    dowCaloriesKcal?: DayOfWeekKcal;
  }>;
  /** The seven days of the week that holds today, as the diary reads them. */
  week: readonly Readonly<{
    localDate: string;
    dayLog: Readonly<{ is_complete: boolean }> | null;
    totals: WeekDayNutrients | null;
  }>[];
  /** Today's planned day, or null on a rest day, when the day is done or running, and with no programme. */
  plan: Readonly<{
    dayName: string;
    exerciseCount: number;
    setCount: number;
    exerciseNames: readonly string[];
  }> | null;
  session: Readonly<{
    id: string;
    startedAt: string;
    dayName: string | null;
    next: WidgetNextSet | null;
  }> | null;
  bodyMap: Readonly<{
    scale: "heat" | "volume";
    figure: "male" | "female";
    volumeValues: Readonly<Record<MuscleId, number>>;
    /** The sets of the heat window. A set that is deleted is left out. */
    heatSets: readonly Readonly<{
      performed_at: string;
      set_type: SetType;
      rir: number | null;
      rpe: number | null;
      deleted_at: string | null;
      snapshot: Readonly<{
        muscles: readonly Readonly<{ muscle_id: MuscleId; weight: number }>[];
      }>;
    }>[];
  }>;
  /** The foods logged most recently, newest first, each with the snapshot of the entry it would repeat. */
  recentFoods: readonly Readonly<{ entryId: string; snapshot: FoodSnapshot }>[];
  lastWeighIn: Readonly<{ weightKg: number; localDate: string }> | null;
}>;

const positiveOrNull = (value: number | null): number | null =>
  value !== null && value > 0 ? value : null;

const weekdayFiguresOf = (figures: DayOfWeekKcal | undefined): WeekdayFigures | undefined => {
  if (figures === undefined || !figures.every((figure) => figure > 0)) {
    return undefined;
  }
  const [monday, tuesday, wednesday, thursday, friday, saturday, sunday] = figures;

  return [monday, tuesday, wednesday, thursday, friday, saturday, sunday];
};

const targetsOf = ({ targets }: WidgetSnapshotInput): WidgetSnapshot["targets"] => {
  const { kcal } = targets;
  if (kcal === null || kcal <= 0) {
    return null;
  }
  const weekdayCaloriesKcal = weekdayFiguresOf(targets.dowCaloriesKcal);

  return {
    caloriesKcal: kcal,
    ...(weekdayCaloriesKcal === undefined ? {} : { weekdayCaloriesKcal }),
    proteinG: positiveOrNull(targets.protein_g),
    carbsG: positiveOrNull(targets.carbs_g),
    fatG: positiveOrNull(targets.fat_g),
  };
};

const weekOf = ({ week }: WidgetSnapshotInput): WidgetSnapshot["week"] =>
  week.map((day) => {
    const totals = weekDayTotals(day.totals);

    return {
      localDate: day.localDate,
      isComplete: day.dayLog?.is_complete ?? false,
      totals:
        totals === null
          ? null
          : {
              kcal: totals.kcal,
              proteinG: totals.protein_g,
              carbsG: totals.carbs_g,
              fatG: totals.fat_g,
            },
    };
  });

const planOf = ({ plan }: WidgetSnapshotInput): WidgetSnapshot["training"]["plan"] =>
  plan === null || plan.exerciseCount < 1 || plan.setCount < 1
    ? null
    : {
        dayName: plan.dayName,
        exerciseCount: plan.exerciseCount,
        setCount: plan.setCount,
        exerciseNames: plan.exerciseNames.slice(0, EXERCISE_NAMES_LIMIT),
      };

const bodyMapOf = ({ bodyMap }: WidgetSnapshotInput): WidgetSnapshot["bodyMap"] => ({
  scale: bodyMap.scale,
  figure: bodyMap.figure,
  volumeValues: bodyMap.volumeValues,
  heatSets: bodyMap.heatSets
    .filter((set) => set.deleted_at === null)
    .map((set) => ({
      performedAt: set.performed_at,
      setType: set.set_type,
      rir: set.rir,
      rpe: set.rpe,
      muscles: set.snapshot.muscles
        .filter(({ weight }) => weight > 0)
        .map(({ muscle_id, weight }) => ({ muscleId: muscle_id, weight })),
    })),
});

const recentFoodsOf = ({ recentFoods }: WidgetSnapshotInput): WidgetSnapshot["recentFoods"] =>
  recentFoods.slice(0, RECENT_FOODS_LIMIT).map(({ entryId, snapshot }) => ({
    entryId,
    name: snapshot.name,
    kcal: nutrientsOfSnapshot(snapshot).kcal ?? 0,
    amount: { quantity: snapshot.quantity, unit: snapshot.unit },
  }));

/**
 * The snapshot for the widgets, or null when the data does not make one the contract accepts (a nonce that
 * is too short, a week that does not hold today). The schema's issues are not kept: they would quote values.
 */
export const buildWidgetSnapshot = (input: WidgetSnapshotInput): WidgetSnapshot | null => {
  const result = widgetSnapshotSchema.safeParse({
    version: WIDGET_SNAPSHOT_VERSION,
    nonce: input.nonce,
    builtAt: input.now.toISOString(),
    timeZone: input.timeZone,
    weightUnit: input.weightUnit,
    today: input.today,
    targets: targetsOf(input),
    week: weekOf(input),
    training: { plan: planOf(input), session: input.session },
    bodyMap: bodyMapOf(input),
    recentFoods: recentFoodsOf(input),
    lastWeighIn: input.lastWeighIn,
  });

  return result.success ? result.data : null;
};

export type WidgetNextSetInput = Readonly<{
  /** The first planned set not yet logged, as `planProgress` gives it. */
  nextSet: Readonly<{ exerciseId: string; setNumber: number }> | null;
  /** The session's exercises in order, with the sets the plan asks for (null for an exercise the person added). */
  exercises: readonly Readonly<{ exerciseId: string; name: string; plannedSets: number | null }>[];
  sessionSets: readonly PrefillSessionSet[];
  /** The exercise's working sets from its latest earlier sessions. */
  lastPerformanceSets: readonly LastPerformanceSet[];
}>;

/**
 * Where the session is and what its next set opens with, for the Training widget: the exercise and set
 * place, and the load and reps core's `prefillNextSet` fills in (the last set of this session, else last
 * time). Null when no planned set is left, or the session does not list the exercise.
 */
export const widgetNextSet = ({
  nextSet,
  exercises,
  sessionSets,
  lastPerformanceSets,
}: WidgetNextSetInput): WidgetNextSet | null => {
  if (nextSet === null) {
    return null;
  }
  const position = exercises.findIndex(({ exerciseId }) => exerciseId === nextSet.exerciseId);
  const exercise = exercises[position];
  if (exercise === undefined) {
    return null;
  }
  const prefill = prefillNextSet(nextSet.exerciseId, sessionSets, lastPerformanceSets);
  const lastTime = prefillNextSet(nextSet.exerciseId, [], lastPerformanceSets);

  return {
    exerciseId: nextSet.exerciseId,
    exerciseName: exercise.name,
    exerciseNumber: position + 1,
    exerciseCount: exercises.length,
    setNumber: nextSet.setNumber,
    setCount: Math.max(exercise.plannedSets ?? nextSet.setNumber, nextSet.setNumber),
    loadKg: prefill.source === "none" ? null : prefill.load_kg,
    reps: prefill.source === "none" ? null : prefill.reps,
    lastTime: lastTime.source === "none" ? null : { loadKg: lastTime.load_kg, reps: lastTime.reps },
  };
};
