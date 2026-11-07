import {
  addSet,
  deleteSession,
  getActiveRoutine,
  getActiveSession,
  getCurrentTrainingGoals,
  listSetsFrom,
  listSuggestionLibrary,
  listWeekSessions,
  saveTrainingGoals,
  startSession,
} from "@keylow/api-client";
import { addCalendarDays, daysSinceMonday, toLocalDate } from "@keylow/core/dates";
import {
  TRAINING_PARAMS_V2,
  currentMuscleState,
  muscleStateRows,
  nextSessionSuggestion,
  planRoutineOf,
  suggestionTargetOf,
  targetedMuscles,
  todayCardOf,
} from "@keylow/core/training";

import { CURRENT_GOAL } from "../fixtures/training.ts";
import { exerciseIdsOf, writeTrainingHistory } from "../fixtures/trainingWrites.ts";

import type { FixtureUser } from "./fixtureUser.ts";
import type { TrainingExercise } from "../fixtures/training.ts";
import type { Equipment, MuscleGroup, MuscleStateRow } from "@keylow/core/training";

// What the training advice cases may do to the eval user and read back from it. Only the user's own client can
// write these rows, so the session builds it from the eval user and the cases reach it through
// `trainingWorldHolder`. The expected figures are worked out here with core, over the rows the way the tools read
// them: the same window of sets, the same goal and routine, the same Today card for the day of a suggestion.

const EVAL_TIME_ZONE = "UTC";

// The live workout of the "during a workout" cases: the bench press, two working sets.
const LIVE_WORKOUT_SETS = 2;
const LIVE_WORKOUT_LOAD = "75";
const LIVE_WORKOUT_REPS = "5";
const LIVE_WORKOUT_RIR = "2";

/**
 * What `suggest_next_session` answers, as numbers. `none` is no session to give: a workout is open, or nothing
 * was ever logged. `nothing` is a day with nothing to suggest.
 */
export type SuggestionAnswer =
  | Readonly<{
      kind: "session";
      /** The day the tool answers for, which the Today card picks. */
      day: string;
      sets: number;
      minutes: number;
      /** The sets of each exercise, as its row prints them. */
      exerciseSets: readonly number[];
      repRanges: readonly (readonly [number, number])[];
    }>
  | Readonly<{ kind: "nothing"; day: string }>
  | Readonly<{ kind: "none" }>;

export type SuggestionQuery = Readonly<{
  minutes: number | null;
  equipment: readonly Equipment[] | null;
}>;

export type MuscleFacts = Readonly<{
  rows: readonly MuscleStateRow[];
  /** The sets and target of the area asked for, summed as the tool sums them. Null for the whole body. */
  area: Readonly<{ sets: number; target: number }> | null;
}>;

export type TrainingWorld = Readonly<{
  anchorDate: string;
  /** Writes the six weeks of workouts, the routines and the goals once, and does nothing after. */
  ensureHistory: () => Promise<void>;
  exerciseIds: () => Promise<ReadonlyMap<TrainingExercise, string>>;
  /** The name of an exercise the model read, or null when there is none with that id. */
  exerciseName: (id: string) => Promise<string | null>;
  suggestion: (query: SuggestionQuery, now: string) => Promise<SuggestionAnswer>;
  muscleFacts: (area: MuscleGroup | null, now: string) => Promise<MuscleFacts>;
  /** Closes the current goal, so the user has none. */
  clearGoal: () => Promise<void>;
  /** Saves the current goal again when the user has none. */
  restoreGoal: () => Promise<void>;
  /** Starts a workout in progress with two bench press sets logged. */
  startWorkout: () => Promise<void>;
  /** Deletes the workout in progress, if there is one. */
  discardWorkout: () => Promise<void>;
}>;

// The repos read the heat window from the day before its first day, as the tools do (`readTrainingInputs`).
const HEAT_LOOKBACK_DAYS = TRAINING_PARAMS_V2.heatWindowDays + 1;

const mondayOf = (localDate: string): string =>
  addCalendarDays(localDate, -daysSinceMonday(localDate));

export function createTrainingWorld({
  client,
  anchorDate,
}: Pick<FixtureUser, "client" | "anchorDate">): TrainingWorld {
  let history: Promise<void> | null = null;

  // What the tools read first: the window of sets, the active routine and the goal.
  async function readInputs(today: string) {
    const [sets, activeRoutine, goal] = await Promise.all([
      listSetsFrom(client, addCalendarDays(today, -HEAT_LOOKBACK_DAYS), today),
      getActiveRoutine(client),
      getCurrentTrainingGoals(client),
    ]);
    return { sets, activeRoutine, goal };
  }

  async function hasLoggedAnySession(): Promise<boolean> {
    const { count, error } = await client
      .from("workout_sessions")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);
    if (error) {
      throw new Error(`Could not count the eval user's workouts (${error.code})`);
    }
    return (count ?? 0) > 0;
  }

  return {
    anchorDate,

    ensureHistory: () => {
      history ??= writeTrainingHistory({ client, anchorDate }).catch((error: unknown) => {
        history = null;
        throw error;
      });
      return history;
    },

    exerciseIds: () => exerciseIdsOf(client),

    async exerciseName(id) {
      const { data, error } = await client
        .from("exercises")
        .select("name")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not read the exercise the model read (${error.code})`);
      }
      return data?.name ?? null;
    },

    async suggestion({ minutes, equipment }, now) {
      const timeZone = EVAL_TIME_ZONE;
      const today = toLocalDate(new Date(now), timeZone);
      const inputs = await readInputs(today);
      const { goal, activeRoutine, sets } = inputs;
      if (goal === null) {
        return { kind: "none" };
      }
      // The Today card, read as the tool and the Train home read it, says which day the suggestion is for.
      const weekStart = mondayOf(today);
      const [weekSessions, sessionInProgress, hasLogged] = await Promise.all([
        listWeekSessions(client, weekStart),
        getActiveSession(client),
        activeRoutine === null ? hasLoggedAnySession() : Promise.resolve(false),
      ]);
      const { plan, card } = todayCardOf({
        routine: planRoutineOf(activeRoutine, timeZone),
        weekSessions,
        sessionInProgress,
        now,
        tz: timeZone,
        weekStart,
        hasEverLoggedSession: hasLogged,
      });
      const read = suggestionTargetOf({
        today,
        card,
        plannedDayId: plan.days.find((day) => day.date === plan.today)?.plannedDay?.id ?? null,
        hasRoutine: activeRoutine !== null,
        hasLoggedSession: hasLogged,
      });
      if (read.status === "in_progress" || read.status === "none") {
        return { kind: "none" };
      }
      const target = read.status === "done" ? read.next : read.target;
      const equipmentToRead =
        equipment === null
          ? goal.equipment
          : goal.equipment.filter((kind) => equipment.includes(kind));
      const library = await listSuggestionLibrary(client, { equipment: equipmentToRead });
      const { suggestion } = nextSessionSuggestion({
        sets,
        now,
        goal,
        library,
        activeRoutine,
        timeZone,
        day: target.day,
        constraints: {
          ...(minutes === null ? {} : { minutes }),
          ...(equipment === null ? {} : { equipment }),
        },
      });
      if (suggestion === null || suggestion.kind === "nothing") {
        return { kind: "nothing", day: target.day };
      }
      return {
        kind: "session",
        day: target.day,
        sets: suggestion.sets,
        minutes: suggestion.minutes,
        exerciseSets: suggestion.exercises.map(({ sets: exerciseSets }) => exerciseSets),
        // A kept exercise has the routine's rep range, which the cases already allow.
        repRanges: suggestion.exercises.flatMap((exercise) =>
          "rep_min" in exercise ? [[exercise.rep_min, exercise.rep_max] as const] : [],
        ),
      };
    },

    async muscleFacts(area, now) {
      const today = toLocalDate(new Date(now), EVAL_TIME_ZONE);
      // Read from the rows, as the tool does, so a workout in progress counts.
      const { sets, activeRoutine, goal } = await readInputs(today);
      const { rows, area: areaTotals } = muscleStateRows(currentMuscleState(sets, now), {
        now,
        timeZone: EVAL_TIME_ZONE,
        area,
        targeted: targetedMuscles({
          routine: activeRoutine,
          priority: goal?.muscle_priority ?? null,
        }),
      });
      return {
        rows,
        area: areaTotals === null ? null : { sets: areaTotals.sets, target: areaTotals.target },
      };
    },

    async clearGoal() {
      const { data, error } = await client
        .from("training_goals")
        .update({ effective_to: new Date().toISOString() })
        .is("effective_to", null)
        .select("id");
      if (error) {
        throw new Error(`Could not close the eval user's training goal (${error.code})`);
      }
      if (data.length !== 1) {
        throw new Error(`Expected to close one training goal and closed ${data.length}`);
      }
    },

    async restoreGoal() {
      if ((await getCurrentTrainingGoals(client)) === null) {
        await saveTrainingGoals(client, CURRENT_GOAL);
      }
    },

    async startWorkout() {
      const bench = (await exerciseIdsOf(client)).get("benchPress");
      if (bench === undefined) {
        throw new Error("The training history has no bench press");
      }
      const now = new Date();
      const started = await startSession(client, { now, tz: EVAL_TIME_ZONE });
      for (let index = 0; index < LIVE_WORKOUT_SETS; index += 1) {
        await addSet(client, {
          sessionId: started.id,
          exerciseId: bench,
          draft: {
            setType: "working",
            load: LIVE_WORKOUT_LOAD,
            reps: LIVE_WORKOUT_REPS,
            rir: LIVE_WORKOUT_RIR,
            rpe: "",
          },
          unit: "kg",
          effortMode: "rir",
          now: new Date(now.getTime() + (index + 1) * 1000),
        });
      }
    },

    async discardWorkout() {
      const live = await getActiveSession(client);
      if (live !== null) {
        await deleteSession(client, live.id);
      }
    },
  };
}

/** The sets and the load of the live workout, which the "during a workout" cases expect in an answer. */
export const LIVE_WORKOUT = {
  sets: LIVE_WORKOUT_SETS,
  loadKg: Number(LIVE_WORKOUT_LOAD),
} as const;
