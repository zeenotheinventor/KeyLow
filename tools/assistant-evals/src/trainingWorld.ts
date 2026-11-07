import {
  addSet,
  deleteSession,
  getActiveRoutine,
  getActiveSession,
  getCurrentTrainingGoals,
  listSuggestionLibrary,
  saveTrainingGoals,
  startSession,
} from "@keylow/api-client";
import { muscleStateRows, targetedMuscles } from "@keylow/core/training";

import { CURRENT_GOAL } from "../fixtures/training.ts";
import { expectedMuscleState, expectedSuggestion } from "../fixtures/trainingTotals.ts";
import { exerciseIdsOf, writeTrainingHistory } from "../fixtures/trainingWrites.ts";

import type { FixtureUser } from "./fixtureUser.ts";
import type { TrainingExercise } from "../fixtures/training.ts";
import type { Equipment, MuscleGroup, MuscleStateRow } from "@keylow/core/training";

// What the training advice cases may do to the eval user and read back from it. Only the user's own client can
// write these rows, so the session builds it from the eval user and the cases reach it through
// `trainingWorldHolder`. The expected numbers are worked out here with core, over the rows as the tools read them.

const EVAL_TIME_ZONE = "UTC";

// The live workout of the "during a workout" cases: the bench press, two working sets.
const LIVE_WORKOUT_SETS = 2;
const LIVE_WORKOUT_LOAD = "75";
const LIVE_WORKOUT_REPS = "5";
const LIVE_WORKOUT_RIR = "2";

/** The session `suggest_next_session` gives for a day, as numbers. `null` when there is nothing to suggest. */
export type SuggestionFacts = Readonly<{
  sets: number;
  minutes: number;
  repRanges: readonly (readonly [number, number])[];
}> | null;

export type SuggestionQuery = Readonly<{
  /** The local day the suggestion is for, `YYYY-MM-DD`. */
  day: string;
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
  suggestionFacts: (query: SuggestionQuery, now: string) => Promise<SuggestionFacts>;
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

export function createTrainingWorld({
  client,
  anchorDate,
}: Pick<FixtureUser, "client" | "anchorDate">): TrainingWorld {
  let history: Promise<void> | null = null;

  async function readInputs() {
    const [goal, activeRoutine] = await Promise.all([
      getCurrentTrainingGoals(client),
      getActiveRoutine(client),
    ]);
    return { goal, activeRoutine };
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

    async suggestionFacts({ day, minutes, equipment }, now) {
      const { goal, activeRoutine } = await readInputs();
      const equipmentToRead =
        equipment === null
          ? (goal?.equipment ?? [])
          : (goal?.equipment ?? []).filter((kind) => equipment.includes(kind));
      const library = await listSuggestionLibrary(client, { equipment: equipmentToRead });
      const read = expectedSuggestion(anchorDate, {
        now,
        day,
        goal,
        library,
        activeRoutine,
        constraints: {
          ...(minutes === null ? {} : { minutes }),
          ...(equipment === null ? {} : { equipment }),
        },
      });
      const { suggestion } = read;
      if (suggestion === null || suggestion.kind === "nothing") {
        return null;
      }
      return {
        sets: suggestion.sets,
        minutes: suggestion.minutes,
        // A kept exercise has the routine's rep range, which the cases already allow.
        repRanges: suggestion.exercises.flatMap((exercise) =>
          "rep_min" in exercise ? [[exercise.rep_min, exercise.rep_max] as const] : [],
        ),
      };
    },

    async muscleFacts(area, now) {
      const { goal, activeRoutine } = await readInputs();
      const { rows, area: areaTotals } = muscleStateRows(expectedMuscleState(anchorDate, now), {
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
      const { error } = await client
        .from("training_goals")
        .update({ effective_to: new Date().toISOString() })
        .is("effective_to", null);
      if (error) {
        throw new Error(`Could not close the eval user's training goal (${error.code})`);
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
