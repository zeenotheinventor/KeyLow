import {
  addSet,
  finishSession,
  getRoutine,
  listRoutines,
  saveExercise,
  saveRoutine,
  saveTrainingGoals,
  setActiveRoutine,
  setRoutineArchived,
  startSession,
  undoAssistantActions,
  updateSet,
} from "@keylow/api-client";

import { ACTIVE_ROUTINE, CURRENT_GOAL } from "../fixtures/training.ts";

import type { FixtureUser } from "./fixtureUser.ts";
import type { AssistantUndoResult } from "@keylow/api-client";
import type { GoalAnswers } from "@keylow/core/training";

// What the training edits cases (KEY-911) do to the eval user besides sending messages, and only ever by adding:
// a case makes its own routine, goal, exercise or workout under a name of its own, and puts back the two things
// the other sets read (the active routine and the goal). Everything is written through the api-client repos the
// app writes with, as the user, so the rows are the ones the app makes. A failure names the action and the
// database's code and never a row, because a routine, a load and an exercise name are health data.

const EVAL_TIME_ZONE = "UTC";
const SESSION_START_TIME = "18:00:00";
const SET_SPACING_MILLISECONDS = 120_000;

/** One planned exercise of a scratch routine, by the `source_ref` the exercise library gives it. */
export type ScratchExercise = Readonly<{
  sourceRef: string;
  sets: number;
  repMin: number;
  repMax: number;
  rir: number | null;
}>;

export type ScratchDay = Readonly<{
  name: string;
  /** 0 (Monday) to 6 (Sunday), or null for any day. */
  weekday: number | null;
  exercises: readonly ScratchExercise[];
}>;

export type ScratchRoutine = Readonly<{
  name: string;
  days: readonly ScratchDay[];
  /** True makes it the active routine, which the case's `cleanUp` must undo with `tidyUp`. */
  active?: true;
}>;

export type SeededRoutine = Readonly<{
  id: string;
  days: readonly Readonly<{ id: string; name: string }>[];
}>;

export type ScratchSet = Readonly<{ sourceRef: string; loadKg: number; reps: number }>;

export type ScratchWorkout = Readonly<{
  /** The local day, `YYYY-MM-DD`. Far from the training history, so no advice number moves. */
  localDate: string;
  /** The routine day the workout was logged from, or null for a workout that follows no routine. */
  routineDayId: string | null;
  sets: readonly ScratchSet[];
}>;

export type ScratchExerciseDraft = Readonly<{
  name: string;
  equipment: "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight";
  muscles: readonly Readonly<{ muscle_id: string; role: "primary" | "secondary" | "stabiliser" }>[];
}>;

export type TrainingEditsWorld = Readonly<{
  anchorDate: string;
  /** Makes a routine with the days and exercises of the plan, and answers its id and the ids of its days. */
  seedRoutine: (plan: ScratchRoutine) => Promise<SeededRoutine>;
  /**
   * Makes the fixture's own routine the active one again, and archives every other live routine, so the next case
   * starts with the list it started with. `get_routines` lists 20 at most and the cases make many, so a routine
   * left live could push the next case's own out of the list.
   */
  tidyUp: () => Promise<void>;
  /** Saves the answers as the current goal. */
  seedGoal: (answers: GoalAnswers) => Promise<void>;
  /** Closes the current goal, so the user has none. */
  clearGoals: () => Promise<void>;
  /** Saves the fixture's goal as the current one, whatever the user has now. */
  restoreGoal: () => Promise<void>;
  /** Makes a finished workout with the sets, and answers its id and the ids of its sets in order. */
  seedWorkout: (
    workout: ScratchWorkout,
  ) => Promise<Readonly<{ sessionId: string; setIds: readonly string[] }>>;
  /** Makes one of the user's own exercises. */
  seedCustomExercise: (draft: ScratchExerciseDraft) => Promise<string>;
  /** Puts the user's weight unit to kg or lb. */
  setWeightUnit: (unit: "kg" | "lb") => Promise<void>;
  /** The change a person makes through the app after the assistant: one more set on the first exercise of a routine. */
  changeRoutineThroughTheApp: (routineId: string) => Promise<void>;
  /** The same for a past set: its reps. */
  changeSetThroughTheApp: (setId: string, reps: number) => Promise<void>;
  /** The same for the goal: a new current goal. */
  changeGoalThroughTheApp: (answers: GoalAnswers) => Promise<void>;
  /** Makes the routine active, as the person would in the app. */
  makeRoutineActive: (routineId: string) => Promise<void>;
  /** Logs a finished workout from a routine day on a day of its own, as the app does. */
  logWorkoutFromDay: (routineDayId: string, localDate: string) => Promise<void>;
  /** The routine the turn's `create_routine` made, from the action the turn left. Null when it made none. */
  routineMadeByTurn: (turnId: string) => Promise<SeededRoutine | null>;
  /** The routine with this name, with the ids of its days. Null when there is none. */
  routineNamed: (name: string) => Promise<SeededRoutine | null>;
  /** Presses Undo for every action of the turn, and answers each result with its reason. */
  pressUndo: (turnId: string) => Promise<readonly AssistantUndoResult[]>;
}>;

let attached: TrainingEditsWorld | null = null;

/** The world of a run, attached by the session when it opens, as the training world is. */
export const trainingEditsWorldHolder = {
  attach: (world: TrainingEditsWorld): void => {
    attached = world;
  },
  detach: (): Promise<void> => {
    attached = null;
    return Promise.resolve();
  },
  current: (): TrainingEditsWorld => {
    if (attached === null) {
      throw new Error("The training edits cases need a session that attached the edits world");
    }
    return attached;
  },
};

const failure = (action: string, error: { code: string }) =>
  new Error(`Could not ${action} (${error.code})`);

export function createTrainingEditsWorld({
  client,
  anchorDate,
}: Pick<FixtureUser, "client" | "anchorDate">): TrainingEditsWorld {
  async function exerciseIdsOf(
    sourceRefs: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const { data, error } = await client
      .from("exercises")
      .select("id,source_ref")
      .eq("source", "free_exercise_db")
      .in("source_ref", [...new Set(sourceRefs)]);
    if (error) {
      throw failure("look up the library exercises", error);
    }
    return new Map(
      data.flatMap(({ id, source_ref }) =>
        source_ref === null ? [] : [[source_ref, id] as const],
      ),
    );
  }

  const idOf = (ids: ReadonlyMap<string, string>, sourceRef: string): string => {
    const found = ids.get(sourceRef);
    if (found === undefined) {
      throw new Error(
        `The library exercise ${sourceRef} is missing, so the stack needs its migrations`,
      );
    }
    return found;
  };

  async function routineById(id: string): Promise<SeededRoutine> {
    const found = await getRoutine(client, id);
    if (found === null) {
      throw new Error("The routine that was just saved cannot be read");
    }
    return { id: found.id, days: found.days.map(({ id: dayId, name }) => ({ id: dayId, name })) };
  }

  async function routineIdNamed(name: string): Promise<string | null> {
    const routines = await listRoutines(client, { archived: true });
    return routines.find((routine) => routine.name === name)?.id ?? null;
  }

  return {
    anchorDate,

    async seedRoutine({ name, days, active }) {
      const ids = await exerciseIdsOf(
        days.flatMap((day) => day.exercises.map((line) => line.sourceRef)),
      );
      const saved = await saveRoutine(client, {
        id: null,
        draft: {
          name,
          days: days.map((day) => ({
            id: null,
            weekday: day.weekday,
            name: day.name,
            exercises: day.exercises.map((line) => ({
              exercise_id: idOf(ids, line.sourceRef),
              target_sets: line.sets,
              rep_min: line.repMin,
              rep_max: line.repMax,
              target_rir: line.rir,
            })),
          })),
        },
      });
      if (active === true) {
        await setActiveRoutine(client, saved.id);
      }
      return routineById(saved.id);
    },

    async tidyUp() {
      const id = await routineIdNamed(ACTIVE_ROUTINE.name);
      if (id === null) {
        throw new Error(
          "The fixture's routine is missing, so the active routine cannot be put back",
        );
      }
      await setActiveRoutine(client, id);
      for (const routine of await listRoutines(client, { archived: false })) {
        if (routine.id !== id) {
          await setRoutineArchived(client, routine.id, true);
        }
      }
    },

    async seedGoal(answers) {
      await saveTrainingGoals(client, answers);
    },

    async clearGoals() {
      const { error } = await client
        .from("training_goals")
        .update({ effective_to: new Date().toISOString() })
        .is("effective_to", null);
      if (error) {
        throw failure("close the eval user's training goal", error);
      }
    },

    async restoreGoal() {
      await saveTrainingGoals(client, CURRENT_GOAL);
    },

    async seedWorkout({ localDate, routineDayId, sets }) {
      const ids = await exerciseIdsOf(sets.map((line) => line.sourceRef));
      const startedAt = new Date(`${localDate}T${SESSION_START_TIME}Z`);
      const started = await startSession(client, {
        routineDayId,
        now: startedAt,
        tz: EVAL_TIME_ZONE,
      });
      if (Date.parse(started.started_at) !== startedAt.getTime()) {
        // `startSession` hands back a workout already in progress, and sets must not be logged into someone else's.
        throw new Error(
          "The eval user has a workout in progress, so a scratch workout cannot be written",
        );
      }
      const setIds: string[] = [];
      for (const [index, line] of sets.entries()) {
        const added = await addSet(client, {
          sessionId: started.id,
          exerciseId: idOf(ids, line.sourceRef),
          draft: {
            setType: "working",
            load: String(line.loadKg),
            reps: String(line.reps),
            rir: "2",
            rpe: "",
          },
          unit: "kg",
          effortMode: "rir",
          now: new Date(startedAt.getTime() + (index + 1) * SET_SPACING_MILLISECONDS),
        });
        setIds.push(added.id);
      }
      await finishSession(client, started.id, {
        endedAt: new Date(startedAt.getTime() + (sets.length + 1) * SET_SPACING_MILLISECONDS),
        note: null,
      });
      return { sessionId: started.id, setIds };
    },

    async seedCustomExercise({ name, equipment, muscles }) {
      const saved = await saveExercise(client, { draft: { name, equipment, muscles } });
      return saved.id;
    },

    async setWeightUnit(unit) {
      const { error } = await client
        .from("profiles")
        .update({ weight_unit: unit })
        .not("id", "is", null);
      if (error) {
        throw failure("set the eval user's weight unit", error);
      }
    },

    async changeRoutineThroughTheApp(routineId) {
      const routine = await getRoutine(client, routineId);
      if (routine === null) {
        throw new Error("The routine to change cannot be read");
      }
      let changed = false;
      await saveRoutine(client, {
        id: routineId,
        draft: {
          name: routine.name,
          days: routine.days.map((day) => ({
            id: day.id,
            weekday: day.weekday,
            name: day.name,
            exercises: day.exercises.map((line) => {
              const isFirst = !changed;
              changed = true;
              return {
                exercise_id: line.exercise.id,
                target_sets: isFirst ? line.target_sets + 1 : line.target_sets,
                rep_min: line.rep_min,
                rep_max: line.rep_max,
                target_rir: line.target_rir,
              };
            }),
          })),
        },
      });
    },

    async changeSetThroughTheApp(setId, reps) {
      await updateSet(client, setId, { reps });
    },

    async changeGoalThroughTheApp(answers) {
      await saveTrainingGoals(client, answers);
    },

    async makeRoutineActive(routineId) {
      await setActiveRoutine(client, routineId);
    },

    async logWorkoutFromDay(routineDayId, localDate) {
      const startedAt = new Date(`${localDate}T${SESSION_START_TIME}Z`);
      const started = await startSession(client, {
        routineDayId,
        now: startedAt,
        tz: EVAL_TIME_ZONE,
      });
      await finishSession(client, started.id, {
        endedAt: new Date(startedAt.getTime() + SET_SPACING_MILLISECONDS),
        note: null,
      });
    },

    async routineMadeByTurn(turnId) {
      const { data, error } = await client
        .from("assistant_actions")
        .select("target_id")
        .eq("turn_id", turnId)
        .eq("tool", "create_routine");
      if (error) {
        throw failure("read the routine the turn made", error);
      }
      const targetId = data[0]?.target_id;
      return targetId === undefined || targetId === null ? null : routineById(targetId);
    },

    async routineNamed(name) {
      const id = await routineIdNamed(name);
      return id === null ? null : routineById(id);
    },

    async pressUndo(turnId) {
      const { data, error } = await client
        .from("assistant_actions")
        .select("id")
        .eq("turn_id", turnId)
        .order("turn_seq");
      if (error) {
        throw failure("read the actions of the turn", error);
      }
      return data.length === 0
        ? []
        : undoAssistantActions(
            client,
            data.map(({ id }) => id),
          );
    },
  };
}
