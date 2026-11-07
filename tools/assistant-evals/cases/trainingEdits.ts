// The training edits set (KEY-911, part of KEY-881): what the assistant does when a person asks it to change their
// training. A case is graded by the database, the arguments and the kind of card, and never by the words of the
// reply, except where the ticket names the words (finish or discard during a workout, a doctor or a physio for
// pain, a question when there is no goal).
//
// FAIR GRADING. A correct reply and a correct play must pass, so:
//   - a case allows every read tool and only the writes it expects, because a model may fairly read an extra tool
//     (the muscles, the goal, the workouts) on the way;
//   - where a name is open (a hack squat is two exercises of the library) a question is a right answer too, and
//     then nothing may be written;
//   - the right plays and the wrong plays of every case are unit tests with no model call (`test/trainingEditsCases.test.ts`).
//
// READ-BACK. A write is proved by the rows it left (the routine as stored, the goal, the set), and the Undo cases
// by the rows it brought back, because a stub hides a request that fails for real. The run is the first real use of
// several things: the routine after an edit, a built routine's numbers, and Undo restoring.
//
// ISOLATION. Every case makes its own routine, goal, workout or exercise under a name of its own ("Scratch ..."), as
// `writes.ts` does, and never edits the fixture's routine. `get_routines` lists 20 at most, so a case that made a
// routine archives every live routine but the fixture's afterwards (`tidyUp`). A case that needs no goal closes the
// eval user's goal and puts it back. A case that makes the routine active puts the fixture's back. The workouts are
// 100 or more days back, past the six weeks the training advice numbers read, so no advice number moves. A case
// only ever adds.
//
// The custom exercise tools (KEY-905) and `delete_workout` (KEY-907) are covered at the end, with the case of a
// question that misnames a day and the Undo that works once the conversation is deleted.
import {
  confirmArchiveExerciseButtons,
  confirmArchiveRoutineButtons,
  confirmDeleteWorkoutButtons,
  confirmRemoveExercisesButtons,
} from "@keylow/core";
import { GOAL_STARTING_ANSWERS, loadToKg } from "@keylow/core/training";

import { READ_TOOLS } from "./ask.ts";
import {
  actionRows,
  anyOfRoutes,
  askedOnce,
  calledWith,
  inputsOf,
  isRecord,
  madeNoModelCall,
  noActionRowsInTurn,
  noQuestionsAsked,
  onlyTheseTools,
  rowCount,
  turnEnded,
  undoOnTurn,
  withContext,
} from "./entryGraders.ts";
import {
  cardKinds,
  cardRowCount,
  currentGoalIs,
  confirmationNamesDay,
  dayNamed,
  deleteCallNamed,
  exerciseIs,
  exerciseOf,
  exercisesOf,
  holdsPreset,
  linkToRoutineEditor,
  matchesPlan,
  noCardLink,
  placeKey,
  placesSetByTheModel,
  presetFor,
  readSetsOfSession,
  routineIs,
  routineMadeIn,
  toolAnswered,
  toolNotCalled,
  toolWasCalled,
  workoutDeleted,
} from "./trainingEditsGraders.ts";
import { askAgainShown } from "./trainingPromptCases.ts";
import { ACTIVE_ROUTINE, CURRENT_GOAL, LIBRARY_EXERCISES } from "../fixtures/training.ts";
import { answerContainsNumber } from "../src/case.ts";
import { trainingEditsWorldHolder } from "../src/trainingEditsWorld.ts";
import { trainingWorldHolder } from "../src/trainingWorldHolder.ts";

import type { RoutineCheck, StoredCustomExercise } from "./trainingEditsGraders.ts";
import type { EvalCase, Grader } from "../src/case.ts";
import type { ScratchRoutine, SeededRoutine } from "../src/trainingEditsWorld.ts";
import type { AssistantUndoResult } from "@keylow/api-client";
import type { GoalAnswers } from "@keylow/core/training";

// ---------------------------------------------------------------------------------------------------------
// The exercises, the routines and the days the cases use
// ---------------------------------------------------------------------------------------------------------

const SQUAT = LIBRARY_EXERCISES.squat;
const LEG_PRESS = LIBRARY_EXERCISES.legPress;
const BENCH_PRESS = LIBRARY_EXERCISES.benchPress;
const OVERHEAD_PRESS = LIBRARY_EXERCISES.overheadPress;
const TRICEPS_PUSHDOWN = LIBRARY_EXERCISES.tricepsPushdown;
const SEATED_ROW = LIBRARY_EXERCISES.seatedRow;
const BARBELL_CURL = LIBRARY_EXERCISES.barbellCurl;
const LEG_CURL = "Lying_Leg_Curls";
const LEG_EXTENSIONS = "Leg_Extensions";

const THURSDAY = 3;
const FRIDAY = 4;
const SATURDAY = 5;
const MONDAY = 0;
const WEDNESDAY = 2;

// Numbers a preset would never give, so a swap that kept them and an add that took the preset tell apart.
const legsDay = {
  name: "Legs",
  weekday: THURSDAY,
  exercises: [
    { sourceRef: SQUAT, sets: 5, repMin: 3, repMax: 5, rir: 2 },
    { sourceRef: LEG_PRESS, sets: 4, repMin: 8, repMax: 12, rir: 2 },
    { sourceRef: LEG_CURL, sets: 3, repMin: 10, repMax: 12, rir: 1 },
  ],
} as const;

const pushDay = {
  name: "Push",
  weekday: MONDAY,
  exercises: [
    { sourceRef: BENCH_PRESS, sets: 4, repMin: 5, repMax: 8, rir: 2 },
    { sourceRef: OVERHEAD_PRESS, sets: 3, repMin: 6, repMax: 10, rir: 2 },
    { sourceRef: TRICEPS_PUSHDOWN, sets: 3, repMin: 10, repMax: 15, rir: 1 },
  ],
} as const;

const pullDay = {
  name: "Pull",
  weekday: WEDNESDAY,
  exercises: [
    { sourceRef: SEATED_ROW, sets: 4, repMin: 8, repMax: 12, rir: 2 },
    { sourceRef: BARBELL_CURL, sets: 3, repMin: 8, repMax: 12, rir: 1 },
  ],
} as const;

const legsRoutine = (name: string): ScratchRoutine => ({ name, days: [legsDay] });

// The goal a goal case starts from: not the fixture's, so a change is a change and the answers kept are visible.
const STARTING_GOAL: GoalAnswers = {
  goal: "aesthetic",
  focus: ["arms"],
  days_per_week: 4,
  session_minutes: 45,
  equipment: ["barbell", "dumbbell"],
  experience: "beginner",
};

const DAYS_BACK_OF_FIRST_WORKOUT = 100;
const WEEK = 7;
const THURSDAY_OF_DATE = 4;

const world = () => trainingEditsWorldHolder.current();

// ---------------------------------------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------------------------------------

/** The `k`th Thursday (1, 2, ...) at least 100 days before today, as `YYYY-MM-DD`. Each case has its own. */
export function thursdayOf(anchorDate: string, k: number): string {
  const day = new Date(`${anchorDate}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - DAYS_BACK_OF_FIRST_WORKOUT);
  while (day.getUTCDay() !== THURSDAY_OF_DATE) {
    day.setUTCDate(day.getUTCDate() - 1);
  }
  day.setUTCDate(day.getUTCDate() - WEEK * (k - 1));
  return day.toISOString().slice(0, 10);
}

/** "Thursday 8 October 2026". */
export const sayThursday = (date: string): string =>
  new Date(`${date}T00:00:00Z`)
    .toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
    .replace(",", "");

const writesOf = (...tools: readonly string[]): Grader =>
  onlyTheseTools(new Set([...READ_TOOLS, ...tools]));

type Define = {
  id: string;
  messages: EvalCase["messages"];
  expect: readonly Grader[];
  extras?: Pick<EvalCase, "afterTurn" | "cleanUp" | "setup" | "prepare">;
};

const define = ({ id, messages, expect, extras = {} }: Define): EvalCase => ({
  id,
  set: "trainingEdits",
  messages,
  expect: expect.map((grade) => withContext(grade, messages)),
  // The fixture's routine and goal are written once for the run, and `tidyUp` and `restoreGoal` put them back,
  // so they have to exist before the first case of a run that names only this set.
  prepare: () => trainingWorldHolder.current().ensureHistory(),
  ...extras,
});

/** A routine the case makes in `setup`, and the ids it was given. */
function scratchRoutine(plan: ScratchRoutine) {
  let seeded: SeededRoutine | null = null;
  return {
    plan,
    name: plan.name,
    setup: async (): Promise<null> => {
      seeded = await world().seedRoutine(plan);
      return null;
    },
    seeded: (): SeededRoutine => {
      if (seeded === null) {
        throw new Error("The routine of the case was not made");
      }
      return seeded;
    },
  };
}

const tidyUp: NonNullable<EvalCase["cleanUp"]> = async () => {
  await world().tidyUp();
};

const tidyUpAndRestoreGoal: NonNullable<EvalCase["cleanUp"]> = async () => {
  // Both run whatever the other does, so a routine that cannot be tidied does not leave the goal closed.
  const failures: unknown[] = [];
  for (const step of [() => world().tidyUp(), () => world().restoreGoal()]) {
    try {
      await step();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures[0] !== undefined) {
    throw failures[0] instanceof Error ? failures[0] : new Error("clean up failed");
  }
};

/** Passes when the routine of the case is as the case made it: nothing was written to it. */
const routineUnchanged = (routine: ReturnType<typeof scratchRoutine>): Grader =>
  routineIs(routine.name, matchesPlan(routine.plan), "the routine is as the case made it");

/** The check of a routine by its day named `Legs`. */
const legsOf =
  (check: (day: NonNullable<ReturnType<typeof dayNamed>>) => string | null): RoutineCheck =>
  (routine) => {
    const day = dayNamed(routine, "Legs");
    return day === undefined ? "the Legs day is gone" : check(day);
  };

const hasNumbers = (
  line: { sets: number; repMin: number; repMax: number; rir: number | null } | undefined,
  sets: number,
  repMin: number,
  repMax: number,
  rir: number | null,
): boolean =>
  line !== undefined &&
  line.sets === sets &&
  line.repMin === repMin &&
  line.repMax === repMax &&
  line.rir === rir;

const startsNoGoal: Pick<EvalCase, "cleanUp"> = { cleanUp: tidyUpAndRestoreGoal };

// ---------------------------------------------------------------------------------------------------------
// The cases
// ---------------------------------------------------------------------------------------------------------

/** The cases of the set for a run whose today is `anchorDate`. */
export function trainingEditsCasesOf(anchorDate: string): readonly EvalCase[] {
  let nextThursday = 0;
  const thursday = (): string => {
    nextThursday += 1;
    return thursdayOf(anchorDate, nextThursday);
  };

  // ---- Routines -----------------------------------------------------------------------------------------

  // The ticket's own sentence: an added exercise at the preset, a swap that keeps the old numbers, a removal and
  // a change of sets, in one call and so on one card. Rows count: the card has one row for each change.
  const fourChanges = scratchRoutine(legsRoutine("Scratch legs four changes"));
  const fourChangesMessage = `In my ${fourChanges.name} routine, add leg extensions to Legs, swap leg press for hack squat, drop leg curls and take squats to 4 sets.`;
  const fourChangesLanded: Grader[] = [
    turnEnded(0, "complete"),
    actionRows("edit_routine", 1),
    cardKinds(0, ["routine_updated"]),
    cardRowCount(0, "routine_updated", 4),
    routineIs(
      fourChanges.name,
      legsOf((day) => {
        const squat = exerciseOf(day, SQUAT);
        if (!hasNumbers(squat, 4, 3, 5, 2)) {
          return "squats are not 4 sets with their old reps and RIR";
        }
        const hackSquat = day.exercises.find((line) => /hack squat/i.test(line.name));
        if (!hasNumbers(hackSquat, 4, 8, 12, 2)) {
          return "no hack squat holds the numbers leg press had";
        }
        if (exerciseOf(day, LEG_PRESS) !== undefined || exerciseOf(day, LEG_CURL) !== undefined) {
          return "leg press or leg curls are still in the day";
        }
        const extensions = exerciseOf(day, LEG_EXTENSIONS);
        if (extensions === undefined || !holdsPreset(extensions, CURRENT_GOAL)) {
          return "leg extensions are missing or not at the preset";
        }
        return day.exercises.length === 3
          ? null
          : `the day holds ${day.exercises.length} exercises`;
      }),
      "Legs holds the four changes",
    ),
    writesOf("edit_routine"),
  ];
  // Hack squat is two exercises of the library, so a question is a fair play too, and then nothing is written.
  const fourChangesAsked: Grader[] = [
    askedOnce(),
    noActionRowsInTurn(0),
    routineUnchanged(fourChanges),
  ];

  const addedAndChanged = scratchRoutine(legsRoutine("Scratch legs added then changed"));
  const addedAndChangedMessage = `In my ${addedAndChanged.name} routine, add leg extensions to Legs and make them 4 sets of 12 to 15.`;

  const oneRemoval = scratchRoutine(legsRoutine("Scratch legs one removal"));
  const oneRemovalMessage = `In my ${oneRemoval.name} routine, take leg curls out of Legs.`;

  const twoRemovals = (answer: "yes" | "no") => {
    const routine = scratchRoutine(legsRoutine(`Scratch legs two removals ${answer}`));
    const buttons = confirmRemoveExercisesButtons(2);
    const messages: EvalCase["messages"] = [
      `In my ${routine.name} routine, take leg press and leg curls out of Legs.`,
      answer === "yes" ? buttons.confirmLabel : buttons.cancelLabel,
    ];
    return { routine, messages };
  };
  const removalsYes = twoRemovals("yes");
  const removalsNo = twoRemovals("no");

  const dayChanges = scratchRoutine({
    name: "Scratch three days",
    days: [pushDay, pullDay, legsDay],
  });
  const dayChangesMessage = `In my ${dayChanges.name} routine, add an Arms day on Saturday, rename Push to Chest and shoulders, and move Legs to Friday.`;

  const removeDay = scratchRoutine({ name: "Scratch remove a day", days: [pushDay, legsDay] });
  const removeDayMessage = `In my ${removeDay.name} routine, remove the Legs day.`;

  const makeActive = scratchRoutine(legsRoutine("Scratch make active"));
  const makeActiveMessage = `Make my ${makeActive.name} routine my active routine.`;

  const archive = (answer: "yes" | "no") => {
    const routine = scratchRoutine(legsRoutine(`Scratch archive ${answer}`));
    const buttons = confirmArchiveRoutineButtons();
    const messages: EvalCase["messages"] = [
      `Archive my ${routine.name} routine.`,
      answer === "yes" ? buttons.confirmLabel : buttons.cancelLabel,
    ];
    return { routine, messages };
  };
  const archiveYes = archive("yes");
  const archiveNo = archive("no");

  const archiveActive = scratchRoutine({ ...legsRoutine("Scratch archive active"), active: true });
  const archiveActiveMessage = `Archive my ${archiveActive.name} routine.`;

  const routineCases: EvalCase[] = [
    define({
      id: "edits-routine-four-changes-in-one-call",
      messages: [fourChangesMessage],
      expect: [anyOfRoutes([fourChangesLanded, fourChangesAsked])],
      extras: { setup: fourChanges.setup, cleanUp: tidyUp },
    }),
    define({
      id: "edits-routine-added-exercise-changed-in-one-call-is-one-row",
      messages: [addedAndChangedMessage],
      expect: [
        turnEnded(0, "complete"),
        actionRows("edit_routine", 1),
        cardKinds(0, ["routine_updated"]),
        // Added, then changed in the same call: one Added row, not an Added row and a Changed row.
        cardRowCount(0, "routine_updated", 1),
        routineIs(
          addedAndChanged.name,
          legsOf((day) => {
            const extensions = exerciseOf(day, LEG_EXTENSIONS);
            const presetRir = extensions === undefined ? null : extensions.rir;
            if (!hasNumbers(extensions, 4, 12, 15, presetRir) || presetRir === null) {
              return "leg extensions are missing or not 4 sets of 12 to 15 with the preset RIR";
            }
            return day.exercises.length === 4
              ? null
              : "the day does not hold the 3 old exercises and the new one";
          }),
          "leg extensions were added with the numbers asked for",
        ),
        writesOf("edit_routine"),
      ],
      extras: { setup: addedAndChanged.setup, cleanUp: tidyUp },
    }),
    define({
      id: "edits-routine-one-removal-asks-nothing",
      messages: [oneRemovalMessage],
      expect: [
        turnEnded(0, "complete"),
        actionRows("edit_routine", 1),
        cardKinds(0, ["routine_updated"]),
        cardRowCount(0, "routine_updated", 1),
        routineIs(
          oneRemoval.name,
          legsOf((day) =>
            exerciseOf(day, LEG_CURL) === undefined && day.exercises.length === 2
              ? null
              : "leg curls are still there, or something else went",
          ),
          "leg curls are out of Legs and nothing else moved",
        ),
        writesOf("edit_routine"),
      ],
      extras: { setup: oneRemoval.setup, cleanUp: tidyUp },
    }),
    define({
      id: "edits-routine-two-removals-after-a-yes",
      messages: removalsYes.messages,
      expect: [
        turnEnded(0, "confirm"),
        noActionRowsInTurn(0),
        actionRows("edit_routine", 1, [1]),
        madeNoModelCall(1),
        cardKinds(1, ["routine_updated"]),
        routineIs(
          removalsYes.routine.name,
          legsOf((day) =>
            day.exercises.length === 1 && exerciseOf(day, SQUAT) !== undefined
              ? null
              : "Legs does not hold squats alone",
          ),
          "leg press and leg curls are out and squats stay",
        ),
        writesOf("edit_routine"),
      ],
      extras: { setup: removalsYes.routine.setup, cleanUp: tidyUp },
    }),
    define({
      id: "edits-routine-two-removals-after-a-no",
      messages: removalsNo.messages,
      expect: [
        turnEnded(0, "confirm"),
        actionRows("edit_routine", 0),
        noActionRowsInTurn(0),
        noActionRowsInTurn(1),
        routineUnchanged(removalsNo.routine),
        writesOf("edit_routine"),
      ],
      extras: { setup: removalsNo.routine.setup, cleanUp: tidyUp },
    }),
    define({
      id: "edits-routine-add-a-day-rename-one-and-move-one",
      messages: [dayChangesMessage],
      expect: [
        turnEnded(0, "complete"),
        actionRows("edit_routine", 1),
        cardKinds(0, ["routine_updated"]),
        cardRowCount(0, "routine_updated", 3),
        routineIs(
          dayChanges.name,
          (routine) => {
            const [push, pull, legs] = dayChanges.seeded().days;
            const ofId = (id: string | undefined) => routine.days.find((day) => day.id === id);
            // Every existing day keeps its id, so the workouts logged from it stay linked.
            if (push === undefined || pull === undefined || legs === undefined) {
              return "the case made fewer than 3 days";
            }
            if (routine.days.length !== 4) {
              return `the routine has ${routine.days.length} days and not 4`;
            }
            if (ofId(push.id)?.name.toLowerCase() !== "chest and shoulders") {
              return "Push was not renamed to Chest and shoulders, or its id changed";
            }
            if (ofId(pull.id)?.name !== "Pull" || ofId(pull.id)?.weekday !== WEDNESDAY) {
              return "Pull changed, or its id did";
            }
            if (ofId(legs.id)?.weekday !== FRIDAY || ofId(legs.id)?.name !== "Legs") {
              return "Legs was not moved to Friday, or its id changed";
            }
            const added = routine.days.find((day) => ![push.id, pull.id, legs.id].includes(day.id));
            // The new day may be empty: nothing was said about its exercises.
            return added !== undefined && /^arms\b/i.test(added.name) && added.weekday === SATURDAY
              ? null
              : "no new Arms day on Saturday";
          },
          "a day was added, one renamed and one moved, and every old day kept its id",
        ),
        writesOf("edit_routine"),
      ],
      extras: { setup: dayChanges.setup, cleanUp: tidyUp },
    }),
    // A day is removed in the routine editor only. The model may call edit_routine with remove_day, which answers a
    // link and writes nothing, or say so without a call. Either is right, and nothing may be written.
    define({
      id: "edits-routine-remove-a-day-gives-a-link-and-writes-nothing",
      messages: [removeDayMessage],
      expect: [
        turnEnded(0, "complete"),
        noActionRowsInTurn(0),
        cardKinds(0, []),
        routineUnchanged(removeDay),
        anyOfRoutes([
          [linkToRoutineEditor(0, () => removeDay.seeded().id)],
          [
            toolNotCalled("edit_routine"),
            answerSays(0, /routine editor/i, "say a day is removed in the routine editor"),
          ],
        ]),
        writesOf("edit_routine"),
      ],
      extras: { setup: removeDay.setup, cleanUp: tidyUp },
    }),
    define({
      id: "edits-routine-make-active",
      messages: [makeActiveMessage],
      expect: [
        turnEnded(0, "complete"),
        actionRows("set_active_routine", 1),
        cardKinds(0, ["routine_active"]),
        routineIs(
          makeActive.name,
          (routine) => (routine.isActive ? null : "the routine is not active"),
          "the routine is the active one",
        ),
        rowCount({ table: "routines", where: { name: ACTIVE_ROUTINE.name, is_active: false } }, 1),
        writesOf("set_active_routine"),
      ],
      extras: { setup: makeActive.setup, cleanUp: tidyUp },
    }),
    define({
      id: "edits-routine-archive-after-a-yes",
      messages: archiveYes.messages,
      expect: [
        turnEnded(0, "confirm"),
        noActionRowsInTurn(0),
        actionRows("archive_routine", 1, [1]),
        madeNoModelCall(1),
        cardKinds(1, ["routine_archived"]),
        routineIs(
          archiveYes.routine.name,
          (routine) => (routine.isArchived ? null : "the routine is not archived"),
          "the routine is archived",
        ),
        writesOf("archive_routine"),
      ],
      extras: { setup: archiveYes.routine.setup, cleanUp: tidyUp },
    }),
    define({
      id: "edits-routine-archive-after-a-no",
      messages: archiveNo.messages,
      expect: [
        turnEnded(0, "confirm"),
        actionRows("archive_routine", 0),
        noActionRowsInTurn(0),
        noActionRowsInTurn(1),
        routineIs(
          archiveNo.routine.name,
          (routine) => (routine.isArchived ? "the routine is archived" : null),
          "the routine is not archived",
        ),
        writesOf("archive_routine"),
      ],
      extras: { setup: archiveNo.routine.setup, cleanUp: tidyUp },
    }),
    // The active routine is refused with no question: a person cannot archive the routine they plan from. A reply
    // that explains it without calling the tool is as right as the tool's refusal, so only the end state is graded.
    define({
      id: "edits-routine-archive-the-active-one-is-refused-without-a-question",
      messages: [archiveActiveMessage],
      expect: [
        turnEnded(0, "complete"),
        noActionRowsInTurn(0),
        cardKinds(0, []),
        routineIs(
          archiveActive.name,
          (routine) =>
            routine.isActive && !routine.isArchived ? null : "the routine was archived",
          "the active routine is still active and not archived",
        ),
        writesOf("archive_routine"),
      ],
      extras: { setup: archiveActive.setup, cleanUp: tidyUp },
    }),
  ];

  // ---- Building -----------------------------------------------------------------------------------------

  const everyExerciseAtThePreset =
    (goal: Pick<GoalAnswers, "goal" | "experience">, days: number): RoutineCheck =>
    (routine) => {
      if (routine.days.length !== days) {
        return `the routine has ${routine.days.length} days and not ${days}`;
      }
      if (routine.days.some((day) => day.exercises.length === 0)) {
        return "a day has no exercise";
      }
      return exercisesOf(routine).every((line) => holdsPreset(line, goal))
        ? null
        : "an exercise holds a number that is not the preset of the goal";
    };
  const builtButNotActive: RoutineCheck = (routine) =>
    routine.isActive || routine.isArchived ? "the routine is active or archived" : null;

  const threeDayMessage = "Build me a 3 day routine.";
  const fiveByFiveMessage = "Build me a 3 day routine with 5 by 5 on squats.";

  const noGoalToGoal: EvalCase["messages"] = [
    "Build me a 3 day routine.",
    "Look better, intermediate.",
  ];
  const aestheticIntermediate = { goal: "aesthetic", experience: "intermediate" } as const;

  const buildCases: EvalCase[] = [
    define({
      id: "edits-build-a-three-day-routine-at-the-presets",
      messages: [threeDayMessage],
      expect: [
        turnEnded(0, "complete"),
        noQuestionsAsked(),
        actionRows("create_routine", 1),
        cardKinds(0, ["routine_created"]),
        // Made active only when asked: nothing here asked.
        toolNotCalled("set_active_routine"),
        routineMadeIn(
          0,
          (routine, context) =>
            builtButNotActive(routine) ??
            everyExerciseAtThePreset(CURRENT_GOAL, 3)(routine) ??
            (context.turns.length === 1 ? null : "more than one turn"),
          "a 3 day routine of real exercises at the presets, not active",
        ),
        writesOf("create_routine"),
      ],
      extras: { cleanUp: tidyUp },
    }),
    define({
      id: "edits-build-with-five-by-five-on-squats-makes-two-cards",
      messages: [fiveByFiveMessage],
      expect: [
        turnEnded(0, "complete"),
        actionRows("create_routine", 1),
        actionRows("edit_routine", 1),
        cardKinds(0, ["routine_created", "routine_updated"]),
        routineMadeIn(
          0,
          (routine, context) => {
            const named = placesSetByTheModel(context.turns);
            const places = routine.days.flatMap((day) =>
              day.exercises.map((line) => ({
                line,
                isNamed: named.has(placeKey(day.id, line.exerciseId)),
              })),
            );
            if (!places.some(({ isNamed }) => isNamed)) {
              return "no exercise was set to the numbers asked for";
            }
            for (const { line, isNamed } of places) {
              if (isNamed) {
                // Only squats were named, and only sets and reps: the RIR is still Ki-Lo's.
                const presetRir = presetFor(CURRENT_GOAL, line.mechanic).targetRir;
                if (!/squat/i.test(line.name) || !hasNumbers(line, 5, 5, 5, presetRir)) {
                  return "a changed exercise is not a squat at 5 sets of 5, or its RIR was changed";
                }
              } else if (!holdsPreset(line, CURRENT_GOAL)) {
                // A number nobody named fails the case.
                return "an exercise nobody named holds a number that is not the preset";
              }
            }
            return null;
          },
          "squats hold 5 sets of 5 and every other row holds the presets",
        ),
        writesOf("create_routine", "edit_routine"),
      ],
      extras: { cleanUp: tidyUp },
    }),
    // Made active only when asked, and then through set_active_routine: the build alone leaves it inactive (the
    // first case of this group), and this one asked for both.
    define({
      id: "edits-build-and-make-it-my-active-routine",
      messages: ["Build me a 3 day routine and make it my active routine."],
      expect: [
        turnEnded(0, "complete"),
        actionRows("create_routine", 1),
        actionRows("set_active_routine", 1),
        cardKinds(0, ["routine_created", "routine_active"]),
        routineMadeIn(
          0,
          (routine) =>
            routine.isActive && !routine.isArchived
              ? everyExerciseAtThePreset(CURRENT_GOAL, 3)(routine)
              : "the routine is not the active one",
          "the built routine is the active one, at the presets",
        ),
        rowCount({ table: "routines", where: { name: ACTIVE_ROUTINE.name, is_active: false } }, 1),
        writesOf("create_routine", "set_active_routine"),
      ],
      extras: { cleanUp: tidyUp },
    }),
    // With no goal nothing is saved and the person is asked once. Their answer saves the goal with the starting
    // answers, then builds, and the routine holds the presets of the goal they gave.
    define({
      id: "edits-build-with-no-goal-asks-then-saves-the-goal-and-builds",
      messages: noGoalToGoal,
      expect: [
        // Turn 1 saved nothing and asked once, by ask_user or in the reply.
        noActionRowsInTurn(0),
        anyOfRoutes([
          [turnEnded(0, "clarify"), askedOnce()],
          [turnEnded(0, "complete"), answerAsksAQuestion(0)],
        ]),
        turnEnded(1, "complete"),
        actionRows("update_training_goals", 1, [1]),
        actionRows("create_routine", 1, [1]),
        cardKinds(1, ["goals_updated", "routine_created"]),
        currentGoalIs(
          { ...GOAL_STARTING_ANSWERS, ...aestheticIntermediate },
          "the goal holds Look better, intermediate and the starting answers",
        ),
        routineMadeIn(
          1,
          (routine) =>
            builtButNotActive(routine) ??
            everyExerciseAtThePreset(aestheticIntermediate, 3)(routine),
          "a 3 day routine at the presets of the goal given",
        ),
        writesOf("update_training_goals", "create_routine"),
      ],
      extras: {
        setup: async () => {
          await world().clearGoals();
          return null;
        },
        ...startsNoGoal,
      },
    }),
  ];

  // Adding with no goal has no preset to take: Ki-Lo answers numbers_need_goals, so the person is asked for the
  // numbers or told where the goal is, and nothing is invented. When they give the numbers it is written, with
  // the RIR left unset because nobody named one.
  const needsGoals = scratchRoutine(legsRoutine("Scratch needs goals"));
  const needsGoalsMessages: EvalCase["messages"] = [
    `In my ${needsGoals.name} routine, add leg extensions to Legs.`,
    `Add leg extensions to Legs in ${needsGoals.name} as 3 sets of 10 to 12 reps.`,
  ];
  buildCases.push(
    define({
      id: "edits-add-without-a-goal-needs-the-numbers",
      messages: needsGoalsMessages,
      expect: [
        noActionRowsInTurn(0),
        cardKinds(0, []),
        actionRows("edit_routine", 1, [1]),
        cardKinds(1, ["routine_updated"]),
        routineIs(
          needsGoals.name,
          legsOf((day) => {
            const extensions = exerciseOf(day, LEG_EXTENSIONS);
            return hasNumbers(extensions, 3, 10, 12, null) && day.exercises.length === 4
              ? null
              : "leg extensions are not 3 sets of 10 to 12 with no RIR";
          }),
          "leg extensions hold the numbers the person gave, and no RIR",
        ),
        writesOf("edit_routine"),
      ],
      extras: {
        setup: async () => {
          await world().clearGoals();
          return needsGoals.setup();
        },
        ...startsNoGoal,
      },
    }),
  );

  // ---- Goals and past workouts --------------------------------------------------------------------------

  const goalChange = define({
    id: "edits-goal-change-keeps-the-other-answers",
    messages: ["Change my goal to getting stronger, 3 days a week."],
    expect: [
      turnEnded(0, "complete"),
      actionRows("update_training_goals", 1),
      cardKinds(0, ["goals_updated"]),
      currentGoalIs(
        { ...STARTING_GOAL, goal: "strength", days_per_week: 3 },
        "the goal is Get stronger, 3 days a week, and the other answers are kept",
      ),
      writesOf("update_training_goals"),
    ],
    extras: {
      setup: async () => {
        await world().seedGoal(STARTING_GOAL);
        return null;
      },
      cleanUp: async () => {
        await world().restoreGoal();
      },
    },
  });

  const pastSetCases = pastSetCasesOf(thursday(), thursday());

  // ---- Undo ---------------------------------------------------------------------------------------------

  const undoCases = undoCasesOf(thursday(), thursday(), thursday());
  const exerciseAndWorkoutCases = exerciseAndWorkoutCasesOf(
    Array.from({ length: 5 }, () => thursday()),
  );

  // ---- During a workout, pain, and a name that is not a thing ------------------------------------------------

  const swapDuringWorkout = scratchRoutine(legsRoutine("Scratch swap during a workout"));
  const swapDuringWorkoutMessages: EvalCase["messages"] = [
    `In my ${swapDuringWorkout.name} routine, swap leg press for leg extensions.`,
    "What did I squat last time?",
  ];

  const injury = scratchRoutine({ name: "Scratch shoulder pain", days: [pushDay] });
  const injuryMessage = `My shoulder hurts when I bench, swap it for something else in my ${injury.name} routine.`;

  const glorp = scratchRoutine(legsRoutine("Scratch glorp"));
  const glorpMessage = `In my ${glorp.name} routine, add glorp curls to Legs.`;

  const otherCases: EvalCase[] = [
    define({
      id: "edits-swap-during-a-workout-writes-nothing-offers-ask-again-and-a-question-answers",
      messages: swapDuringWorkoutMessages,
      expect: [
        turnEnded(0, "complete"),
        noActionRowsInTurn(0),
        cardKinds(0, []),
        routineUnchanged(swapDuringWorkout),
        // Stored on the refusal, drawn because nothing landed. The live `ask_again` event is sent on the same rule.
        askAgainShown(0, true),
        answerSaysFinishOrDiscard(0),
        turnEnded(1, "complete"),
        noActionRowsInTurn(1),
        askAgainShown(1, false),
        answerContainsNumber(112.5),
        writesOf("edit_routine"),
      ],
      extras: {
        setup: async () => {
          await swapDuringWorkout.setup();
          await trainingWorldHolder.current().startWorkout();
          return null;
        },
        cleanUp: async () => {
          // Both are done whatever the other does, so a failure does not leave a workout open for the next case.
          const failures: unknown[] = [];
          for (const step of [
            () => trainingWorldHolder.current().discardWorkout(),
            () => world().tidyUp(),
          ]) {
            try {
              await step();
            } catch (error) {
              failures.push(error);
            }
          }
          if (failures[0] !== undefined) {
            throw failures[0] instanceof Error ? failures[0] : new Error("clean up failed");
          }
        },
      },
    }),
    define({
      id: "edits-pain-when-benching-swaps-and-points-to-a-doctor",
      messages: [injuryMessage],
      expect: [
        turnEnded(0, "complete"),
        actionRows("edit_routine", 1),
        cardKinds(0, ["routine_updated"]),
        routineIs(
          injury.name,
          (routine) => {
            const day = dayNamed(routine, "Push");
            if (day === undefined || day.exercises.length !== 3) {
              return "the Push day does not hold 3 exercises";
            }
            if (exerciseOf(day, BENCH_PRESS) !== undefined) {
              return "the bench press is still in the day";
            }
            return exerciseOf(day, OVERHEAD_PRESS) !== undefined &&
              exerciseOf(day, TRICEPS_PUSHDOWN) !== undefined
              ? null
              : "an exercise that was not asked about went";
          },
          "the bench press was swapped for another exercise and the rest stayed",
        ),
        // The one thing the reply must say, by the prompt: pain goes to a doctor or a physio.
        answerSays(0, /doctor|physio/i, "point to a doctor or a physio"),
        writesOf("edit_routine"),
      ],
      extras: { setup: injury.setup, cleanUp: tidyUp },
    }),
    define({
      id: "edits-an-exercise-that-does-not-exist-is-searched-or-asked-never-guessed",
      messages: [glorpMessage],
      expect: [
        noActionRowsInTurn(0),
        cardKinds(0, []),
        routineUnchanged(glorp),
        anyOfRoutes([[toolWasCalled("search_exercises")], [askedOnce()]]),
        // No write at all, so no id was made up: a call with an id nobody searched for is a guess.
        onlyTheseTools(READ_TOOLS),
      ],
      extras: { setup: glorp.setup, cleanUp: tidyUp },
    }),
  ];

  return [
    ...routineCases,
    ...buildCases,
    goalChange,
    ...pastSetCases,
    ...undoCases,
    ...otherCases,
    ...exerciseAndWorkoutCases,
  ];
}

// ---------------------------------------------------------------------------------------------------------
// Words, the three places a ticket names them
// ---------------------------------------------------------------------------------------------------------

/** Passes when the reply of the turn says what the pattern matches. The ticket names these words. */
export function answerSays(turnIndex: number, pattern: RegExp, description: string): Grader {
  return ({ turns }) => {
    const answer = turns[turnIndex]?.answer ?? "";
    return Promise.resolve(
      pattern.test(answer)
        ? { passed: true, reason: `the reply does ${description}` }
        : { passed: false, reason: `the reply does not ${description}` },
    );
  };
}

const answerSaysFinishOrDiscard = (turnIndex: number): Grader =>
  answerSays(turnIndex, /finish|discard/i, "say to finish or discard the workout");

/** Passes when the reply of the turn asks one question, for a case where the question is not an `ask_user` call. */
export const answerAsksAQuestion = (turnIndex: number): Grader =>
  answerSays(turnIndex, /\?/, "ask a question");

// ---------------------------------------------------------------------------------------------------------
// Past workouts
// ---------------------------------------------------------------------------------------------------------

const PAST_SQUAT_LOAD_KG = 100;
const PAST_SQUAT_REPS = 6;
const PAST_PRESS_LOAD_KG = 160;
const PAST_PRESS_REPS = 10;
const SQUAT_SETS = 3;
const PRESS_SETS = 2;
// The set the person means by "set 2 of squats": the second of the three, counted from 1.
const SECOND_SQUAT_SET = 1;
const NEW_REPS = 8;
const LB_BEFORE = 220;
const LB_AFTER = 225;
// 1 microgram: the loads are stored to the gram, so any real difference is far larger than this.
const LOAD_TOLERANCE_KG = 1e-6;

/** A finished workout the case makes: three squat sets and two leg press sets, on a Thursday of its own. */
function pastWorkout(day: string, squatLoadKg: number) {
  let seeded: Readonly<{ sessionId: string; setIds: readonly string[] }> | null = null;
  return {
    day,
    setup: async (): Promise<void> => {
      seeded = await world().seedWorkout({
        localDate: day,
        routineDayId: null,
        sets: [
          ...Array.from({ length: SQUAT_SETS }, () => ({
            sourceRef: SQUAT,
            loadKg: squatLoadKg,
            reps: PAST_SQUAT_REPS,
          })),
          ...Array.from({ length: PRESS_SETS }, () => ({
            sourceRef: LEG_PRESS,
            loadKg: PAST_PRESS_LOAD_KG,
            reps: PAST_PRESS_REPS,
          })),
        ],
      });
    },
    seeded: () => {
      if (seeded === null) {
        throw new Error("The workout of the case was not made");
      }
      return seeded;
    },
  };
}

type PastWorkout = ReturnType<typeof pastWorkout>;

type ExpectedSet = Readonly<{ reps: number; loadKg: number }>;

/** Passes when the workout's sets, in the order they were logged, are these, to a microgram of load. */
function workoutSetsAre(
  workout: PastWorkout,
  expected: readonly ExpectedSet[],
  description: string,
): Grader {
  return async ({ database }) => {
    const sets = await readSetsOfSession(database, workout.seeded().sessionId);
    const problem =
      sets.length !== expected.length
        ? `the workout holds ${sets.length} sets and not ${expected.length}`
        : sets.flatMap((set, index) => {
            const want = expected[index];
            return want !== undefined &&
              set.reps === want.reps &&
              set.loadKg !== null &&
              Math.abs(set.loadKg - want.loadKg) < LOAD_TOLERANCE_KG
              ? []
              : [`set ${index + 1}`];
          });
    return problem === "" || (Array.isArray(problem) && problem.length === 0)
      ? { passed: true, reason: description }
      : {
          passed: false,
          reason: `${description}: ${Array.isArray(problem) ? problem.join(", ") : problem} differ`,
        };
  };
}

/** The sets of a workout from `pastWorkout`, with the squat sets changed. */
const setsWith = (
  squat: ExpectedSet | ((index: number) => ExpectedSet),
): readonly ExpectedSet[] => [
  ...Array.from({ length: SQUAT_SETS }, (_, index) =>
    typeof squat === "function" ? squat(index) : squat,
  ),
  ...Array.from({ length: PRESS_SETS }, () => ({
    reps: PAST_PRESS_REPS,
    loadKg: PAST_PRESS_LOAD_KG,
  })),
];

const squatsAsSeeded = (loadKg: number): ExpectedSet => ({ reps: PAST_SQUAT_REPS, loadKg });

const repsMessage = (day: string): string =>
  `Set 2 of squats on ${sayThursday(day)} was ${NEW_REPS} reps, not ${PAST_SQUAT_REPS}.`;

function pastSetCasesOf(repsDay: string, poundsDay: string): EvalCase[] {
  const reps = pastWorkout(repsDay, PAST_SQUAT_LOAD_KG);
  const pounds = pastWorkout(poundsDay, loadToKg(LB_BEFORE, "lb"));
  const poundsMessage = `All my squat sets on ${sayThursday(poundsDay)} were ${LB_AFTER} lb, not ${LB_BEFORE}.`;
  const poundsAfter = loadToKg(LB_AFTER, "lb");
  return [
    define({
      id: "edits-past-set-reps-corrected",
      messages: [repsMessage(repsDay)],
      expect: [
        turnEnded(0, "complete"),
        actionRows("update_past_set", 1),
        cardKinds(0, ["set_updated"]),
        calledWith(
          "update_past_set",
          (input) =>
            input["set_id"] === reps.seeded().setIds[SECOND_SQUAT_SET] &&
            input["reps"] === NEW_REPS,
          "the second squat set and 8 reps",
        ),
        workoutSetsAre(
          reps,
          setsWith((index) =>
            index === SECOND_SQUAT_SET
              ? { reps: NEW_REPS, loadKg: PAST_SQUAT_LOAD_KG }
              : squatsAsSeeded(PAST_SQUAT_LOAD_KG),
          ),
          "only the second squat set changed, to 8 reps",
        ),
        writesOf("update_past_set"),
      ],
      extras: { setup: async () => (await reps.setup(), null) },
    }),
    // The person's unit is lb, so the load is sent as said (225) and the tool converts it, once, to kilograms.
    define({
      id: "edits-past-sets-in-pounds-are-stored-in-kilograms-to-the-gram",
      messages: [poundsMessage],
      expect: [
        turnEnded(0, "complete"),
        actionRows("update_past_set", SQUAT_SETS),
        // Three writes, one card.
        cardKinds(0, ["set_updated"]),
        ({ turns }) => {
          const inputs = inputsOf(turns, "update_past_set").filter(isRecord);
          const ids = new Set(inputs.map((input) => input["set_id"]));
          return Promise.resolve(
            inputs.length === SQUAT_SETS &&
              ids.size === SQUAT_SETS &&
              inputs.every((input) => input["load"] === LB_AFTER)
              ? { passed: true, reason: "each squat set was sent once, as 225" }
              : {
                  passed: false,
                  reason: "the calls are not one for each squat set with the load as said",
                },
          );
        },
        workoutSetsAre(
          pounds,
          setsWith({ reps: PAST_SQUAT_REPS, loadKg: poundsAfter }),
          "the squat sets hold 225 lb in kilograms to the gram and the leg press sets are untouched",
        ),
        writesOf("update_past_set"),
      ],
      extras: {
        setup: async () => {
          await world().setWeightUnit("lb");
          await pounds.setup();
          return null;
        },
        cleanUp: async () => {
          await world().setWeightUnit("kg");
        },
      },
    }),
  ];
}

// ---------------------------------------------------------------------------------------------------------
// Undo, and Undo when something changed since
// ---------------------------------------------------------------------------------------------------------

/**
 * Presses Undo once for the turn after a change through the app has been made (or none), and keeps what the
 * route answered with its reason, so the case can say why an Undo was refused.
 */
function pressedAfter(
  turnIndex: number,
  changeFirst: (turnId: string) => Promise<void> = () => Promise.resolve(),
) {
  let results: readonly AssistantUndoResult[] | null = null;
  const afterTurn: NonNullable<EvalCase["afterTurn"]> = async ({ index, result }) => {
    if (index === turnIndex) {
      await changeFirst(result.turnId);
      results = await world().pressUndo(result.turnId);
    }
  };
  const refusedBecause =
    (reason: string): Grader =>
    () => {
      const [only] = results ?? [];
      return Promise.resolve(
        results?.length === 1 && only?.result === "undo_unavailable" && only.reason === reason
          ? { passed: true, reason: `Undo was refused because ${reason}` }
          : {
              passed: false,
              reason: `Undo answered ${results?.map((item) => `${item.result}${item.reason === undefined ? "" : ` (${item.reason})`}`).join(", ") ?? "nothing"}, not undo_unavailable (${reason})`,
            },
      );
    };
  return { afterTurn, refusedBecause };
}

const BUILD_ONE_DAY = "Build me a routine with one day and two exercises.";

function undoCasesOf(setDay: string, changedSetDay: string, loggedDay: string): EvalCase[] {
  const sets = pastWorkout(changedSetDay, PAST_SQUAT_LOAD_KG);
  const squatsToThree = (name: string) => `In my ${name} routine, take squats to 3 sets.`;
  // 4 sets would be the squat edit of other cases, and the app's change adds one, so 3 then 4 are told apart from 5.
  const squatIsAt = (sets: number): RoutineCheck =>
    legsOf((day) =>
      exerciseOf(day, SQUAT)?.sets === sets ? null : `squats are not at ${sets} sets`,
    );

  // ---- one normal Undo for each write: undone, then already undone, and the rows are back ----
  const editRoutine = scratchRoutine(legsRoutine("Scratch undo edit"));
  const editUndo = undoOnTurn(0, 1);
  const activeRoutine = scratchRoutine(legsRoutine("Scratch undo active"));
  const activeUndo = undoOnTurn(0, 1);
  const archived = scratchRoutine(legsRoutine("Scratch undo archive"));
  const archivedUndo = undoOnTurn(1, 1);
  const archivedButtons = confirmArchiveRoutineButtons();
  const pastSet = pastWorkout(setDay, PAST_SQUAT_LOAD_KG);
  const pastSetUndo = undoOnTurn(0, 1);
  const goalUndo = undoOnTurn(0, 1);
  const builtUndo = undoOnTurn(0, 1);

  // ---- Undo refused because the person changed it since: the refusal's reason, and their change stands ----
  const routineChanged = scratchRoutine(legsRoutine("Scratch changed routine"));
  const routineChangedPress = pressedAfter(0, () =>
    world().changeRoutineThroughTheApp(routineChanged.seeded().id),
  );
  const setChangedPress = pressedAfter(0, () =>
    world().changeSetThroughTheApp(sets.seeded().setIds[SECOND_SQUAT_SET] ?? "", 7),
  );
  const goalChangedPress = pressedAfter(0, () =>
    world().changeGoalThroughTheApp({ ...STARTING_GOAL, goal: "strength", days_per_week: 5 }),
  );
  const builtChanged = pressedAfter(0, async (turnId) => {
    const made = await world().routineMadeByTurn(turnId);
    if (made !== null) {
      await world().changeRoutineThroughTheApp(made.id);
    }
  });
  const builtActive = pressedAfter(0, async (turnId) => {
    const made = await world().routineMadeByTurn(turnId);
    if (made !== null) {
      await world().makeRoutineActive(made.id);
    }
  });
  const builtLogged = pressedAfter(0, async (turnId) => {
    const made = await world().routineMadeByTurn(turnId);
    const [firstDay] = made?.days ?? [];
    if (firstDay !== undefined) {
      await world().logWorkoutFromDay(firstDay.id, loggedDay);
    }
  });
  const addedDay = scratchRoutine(legsRoutine("Scratch added day"));
  const addedDayLogged = pressedAfter(0, async () => {
    const now = await world().routineNamed(addedDay.name);
    const known = new Set(addedDay.seeded().days.map(({ id }) => id));
    const added = now?.days.find(({ id }) => !known.has(id));
    if (added !== undefined) {
      await world().logWorkoutFromDay(added.id, loggedDay);
    }
  });
  const gone = (name: string): Grader =>
    rowCount({ table: "routines", where: { name, is_archived: false } }, 1);

  return [
    define({
      id: "edits-undo-a-routine-edit",
      messages: [squatsToThree(editRoutine.name)],
      expect: [
        actionRows("edit_routine", 1),
        editUndo.undone,
        routineUnchanged(editRoutine),
        writesOf("edit_routine"),
      ],
      extras: { setup: editRoutine.setup, afterTurn: editUndo.afterTurn, cleanUp: tidyUp },
    }),
    define({
      id: "edits-undo-making-a-routine-active",
      messages: [`Make my ${activeRoutine.name} routine my active routine.`],
      expect: [
        actionRows("set_active_routine", 1),
        activeUndo.undone,
        routineIs(
          activeRoutine.name,
          (routine) => (routine.isActive ? "the routine is still active" : null),
          "the routine is not active",
        ),
        rowCount({ table: "routines", where: { name: ACTIVE_ROUTINE.name, is_active: true } }, 1),
        writesOf("set_active_routine"),
      ],
      extras: { setup: activeRoutine.setup, afterTurn: activeUndo.afterTurn, cleanUp: tidyUp },
    }),
    define({
      id: "edits-undo-an-archived-routine",
      messages: [`Archive my ${archived.name} routine.`, archivedButtons.confirmLabel],
      expect: [
        actionRows("archive_routine", 1),
        madeNoModelCall(1),
        archivedUndo.undone,
        routineIs(
          archived.name,
          (routine) => (routine.isArchived ? "the routine is still archived" : null),
          "the routine is back",
        ),
        gone(archived.name),
        writesOf("archive_routine"),
      ],
      extras: { setup: archived.setup, afterTurn: archivedUndo.afterTurn, cleanUp: tidyUp },
    }),
    define({
      id: "edits-undo-a-past-set",
      messages: [repsMessage(setDay)],
      expect: [
        actionRows("update_past_set", 1),
        pastSetUndo.undone,
        workoutSetsAre(
          pastSet,
          setsWith(squatsAsSeeded(PAST_SQUAT_LOAD_KG)),
          "the sets are back as they were",
        ),
        writesOf("update_past_set"),
      ],
      extras: {
        setup: async () => (await pastSet.setup(), null),
        afterTurn: pastSetUndo.afterTurn,
      },
    }),
    define({
      id: "edits-undo-a-goal-change",
      messages: ["Change my goal to getting stronger, 3 days a week."],
      expect: [
        actionRows("update_training_goals", 1),
        goalUndo.undone,
        currentGoalIs(STARTING_GOAL, "the goal is back as it was"),
        writesOf("update_training_goals"),
      ],
      extras: {
        setup: async () => (await world().seedGoal(STARTING_GOAL), null),
        afterTurn: goalUndo.afterTurn,
        cleanUp: async () => world().restoreGoal(),
      },
    }),
    define({
      id: "edits-undo-a-built-routine",
      messages: [BUILD_ONE_DAY],
      expect: [
        actionRows("create_routine", 1),
        builtUndo.undone,
        routineMadeIn(
          0,
          (routine) => (routine.isArchived ? null : "the routine is not archived"),
          "the built routine is archived",
        ),
        writesOf("create_routine"),
      ],
      extras: { afterTurn: builtUndo.afterTurn, cleanUp: tidyUp },
    }),
    define({
      id: "edits-undo-refused-after-the-routine-changed-and-their-change-stands",
      messages: [squatsToThree(routineChanged.name)],
      expect: [
        actionRows("edit_routine", 1),
        routineChangedPress.refusedBecause("changed"),
        // Their change (one set more on the first exercise) is what is stored: the Undo did not put 5 sets back.
        routineIs(routineChanged.name, squatIsAt(4), "the person's change stands"),
        writesOf("edit_routine"),
      ],
      extras: {
        setup: routineChanged.setup,
        afterTurn: routineChangedPress.afterTurn,
        cleanUp: tidyUp,
      },
    }),
    define({
      id: "edits-undo-refused-after-the-set-changed-and-their-change-stands",
      messages: [repsMessage(changedSetDay)],
      expect: [
        actionRows("update_past_set", 1),
        setChangedPress.refusedBecause("changed"),
        workoutSetsAre(
          sets,
          setsWith((index) =>
            index === SECOND_SQUAT_SET
              ? { reps: 7, loadKg: PAST_SQUAT_LOAD_KG }
              : squatsAsSeeded(PAST_SQUAT_LOAD_KG),
          ),
          "the person's 7 reps stand",
        ),
        writesOf("update_past_set"),
      ],
      extras: {
        setup: async () => (await sets.setup(), null),
        afterTurn: setChangedPress.afterTurn,
      },
    }),
    define({
      id: "edits-undo-refused-after-the-goal-changed-and-their-change-stands",
      messages: ["Change my goal to getting stronger, 3 days a week."],
      expect: [
        actionRows("update_training_goals", 1),
        goalChangedPress.refusedBecause("changed"),
        currentGoalIs(
          { ...STARTING_GOAL, goal: "strength", days_per_week: 5 },
          "the person's goal stands",
        ),
        writesOf("update_training_goals"),
      ],
      extras: {
        setup: async () => (await world().seedGoal(STARTING_GOAL), null),
        afterTurn: goalChangedPress.afterTurn,
        cleanUp: async () => world().restoreGoal(),
      },
    }),
    // A built routine is undone by archiving it, which would lose a change, an active plan or a logged workout, so
    // each of the three is refused for its own reason.
    define({
      id: "edits-undo-of-a-built-routine-refused-after-an-edit",
      messages: [BUILD_ONE_DAY],
      expect: [
        actionRows("create_routine", 1),
        builtChanged.refusedBecause("changed"),
        routineMadeIn(
          0,
          (routine) => (routine.isArchived ? "the routine was archived" : null),
          "the routine stands",
        ),
        writesOf("create_routine"),
      ],
      extras: { afterTurn: builtChanged.afterTurn, cleanUp: tidyUp },
    }),
    define({
      id: "edits-undo-of-a-built-routine-refused-once-it-is-active",
      messages: [BUILD_ONE_DAY],
      expect: [
        actionRows("create_routine", 1),
        builtActive.refusedBecause("active"),
        routineMadeIn(
          0,
          (routine) =>
            routine.isActive && !routine.isArchived
              ? null
              : "the routine is not active, or was archived",
          "the active routine stands",
        ),
        writesOf("create_routine"),
      ],
      extras: { afterTurn: builtActive.afterTurn, cleanUp: tidyUp },
    }),
    define({
      id: "edits-undo-of-a-built-routine-refused-once-a-workout-was-logged-from-it",
      messages: [BUILD_ONE_DAY],
      expect: [
        actionRows("create_routine", 1),
        builtLogged.refusedBecause("logged"),
        routineMadeIn(
          0,
          (routine) => (routine.isArchived ? "the routine was archived" : null),
          "the routine stands",
        ),
        writesOf("create_routine"),
      ],
      extras: { afterTurn: builtLogged.afterTurn, cleanUp: tidyUp },
    }),
    define({
      id: "edits-undo-of-an-added-day-refused-once-a-workout-was-logged-from-it",
      messages: [`In my ${addedDay.name} routine, add an Arms day on Saturday.`],
      expect: [
        actionRows("edit_routine", 1),
        addedDayLogged.refusedBecause("logged"),
        routineIs(
          addedDay.name,
          (routine) =>
            routine.days.some((day) => /^arms\b/i.test(day.name))
              ? null
              : "the added day was taken out",
          "the added day stands",
        ),
        writesOf("edit_routine"),
      ],
      extras: { setup: addedDay.setup, afterTurn: addedDayLogged.afterTurn, cleanUp: tidyUp },
    }),
  ];
}

// ---------------------------------------------------------------------------------------------------------
// The user's own exercises, deleting a workout, and Undo after the conversation is gone
// ---------------------------------------------------------------------------------------------------------

const FLY_MUSCLES = [
  { muscle_id: "chest_lower", role: "primary" },
  { muscle_id: "delt_front", role: "secondary" },
] as const;
const FIRST_DELETE_DAY = 0;
const SQUAT_SETS_OF_A_LEGS_WORKOUT = 2;

/** One of the user's own exercises, made in `setup`. */
function customExercise(name: string, equipment: "dumbbell" | "cable" | "machine") {
  let id: string | null = null;
  return {
    name,
    setup: async (): Promise<void> => {
      id = await world().seedCustomExercise({ name, equipment, muscles: FLY_MUSCLES });
    },
    id: (): Readonly<{ id: string }> => {
      if (id === null) {
        throw new Error("The exercise of the case was not made");
      }
      return { id };
    },
  };
}

/** A routine with a Legs day, and a finished Legs workout on each of the days, the newest first. */
function legsWorkouts(name: string, dates: readonly string[]) {
  const routine = scratchRoutine(legsRoutine(name));
  const sessions: string[] = [];
  return {
    routine,
    dates,
    setup: async (): Promise<null> => {
      await routine.setup();
      const [legs] = routine.seeded().days;
      sessions.length = 0;
      for (const localDate of dates) {
        const seeded = await world().seedWorkout({
          localDate,
          routineDayId: legs?.id ?? null,
          sets: Array.from({ length: SQUAT_SETS_OF_A_LEGS_WORKOUT }, () => ({
            sourceRef: SQUAT,
            loadKg: PAST_SQUAT_LOAD_KG,
            reps: PAST_SQUAT_REPS,
          })),
        });
        sessions.push(seeded.sessionId);
      }
      return null;
    },
    session: (index: number) => (): string => {
      const found = sessions[index];
      if (found === undefined) {
        throw new Error("The workout of the case was not made");
      }
      return found;
    },
  };
}

const liveSetsOf =
  (session: () => string, expected: number): Grader =>
  async ({ database }) => {
    const sets = await readSetsOfSession(database, session());
    return sets.length === expected
      ? { passed: true, reason: `the workout holds its ${expected} sets` }
      : { passed: false, reason: `the workout holds ${sets.length} sets and not ${expected}` };
  };

function exerciseAndWorkoutCasesOf(days: readonly string[]): EvalCase[] {
  const at = (index: number): string => {
    const found = days[index];
    if (found === undefined) {
      throw new Error("The case set needs more scratch Thursdays");
    }
    return found;
  };
  const archiveButtons = confirmArchiveExerciseButtons();
  const deleteButtons = confirmDeleteWorkoutButtons();
  const hasFlyMuscles = (exercise: StoredCustomExercise): string | null =>
    exercise.muscles.some((m) => m.muscleId === "chest_lower" && m.role === "primary") &&
    exercise.muscles.some((m) => m.muscleId === "delt_front" && m.role === "secondary")
      ? null
      : "the muscle map lost the chest or the secondary front delts";

  // ---- Create, edit and archive a custom exercise (KEY-905). No screen edits one, so no card holds a link. ----
  const createName = "Scratch cable crossover";
  const createUndoName = "Scratch cable press";
  const createMessage = (name: string) =>
    `Add a custom exercise called ${name}. It uses a cable, works the chest as the main muscle and the front delts as a secondary one.`;
  const isCableChest = (exercise: StoredCustomExercise): string | null =>
    exercise.equipment === "cable" &&
    exercise.muscles.some((m) => m.muscleId.startsWith("chest") && m.role === "primary") &&
    exercise.muscles.some((m) => m.muscleId === "delt_front" && m.role === "secondary")
      ? null
      : "not a cable exercise with a chest primary and secondary front delts";

  const edited = customExercise("Scratch dumbbell fly", "dumbbell");
  const editMessage = "Change my Scratch dumbbell fly exercise to use a cable instead.";
  const editedUndo = customExercise("Scratch dumbbell raise", "dumbbell");
  const editedUndoPress = undoOnTurn(0, 1);
  const editSavedBy = (target: () => Readonly<{ id: string }>) =>
    calledWith(
      "save_custom_exercise",
      (input) => input["id"] === target().id,
      "the id search_exercises gave",
    );

  const archiveYes = customExercise("Scratch rope pulldown", "machine");
  const archiveNo = customExercise("Scratch rope curl", "machine");
  const archiveUndo = customExercise("Scratch rope row", "machine");
  const archiveUndoPress = undoOnTurn(1, 1);
  const archiveMessage = (name: string) => `Archive my ${name} exercise.`;
  const isArchived = (exercise: StoredCustomExercise): string | null =>
    exercise.isArchived ? null : "the exercise is not archived";
  const isLive = (exercise: StoredCustomExercise): string | null =>
    exercise.isArchived ? "the exercise is archived" : null;

  const inUse = customExercise("Scratch row machine", "machine");
  const inUseRoutine = scratchRoutine(legsRoutine("Scratch uses a custom exercise"));

  const createUndoPress = undoOnTurn(0, 1);

  // ---- Delete a workout (KEY-907) ----
  const yes = legsWorkouts("Scratch delete yes", [at(FIRST_DELETE_DAY)]);
  const no = legsWorkouts("Scratch delete no", [at(1)]);
  // Two finished workouts on different days: the day the question names must be the workout the press deletes.
  const misnamed = legsWorkouts("Scratch delete two days", [at(2), at(3)]);
  const undoDelete = legsWorkouts("Scratch delete undo", [at(4)]);
  const undoDeletePress = undoOnTurn(1, 1);
  const deleteMessage = (day: string) => `Delete my Legs workout from ${sayThursday(day)}.`;

  // ---- Undo once the conversation is deleted: the writes that keep nothing beside their card ----
  const stored = scratchRoutine(legsRoutine("Scratch undo after delete"));
  let undoneAfterDelete: readonly AssistantUndoResult[] | null = null;

  return [
    define({
      id: "edits-exercise-create-a-custom-one-with-no-card-link",
      messages: [createMessage(createName)],
      expect: [
        turnEnded(0, "complete"),
        actionRows("save_custom_exercise", 1),
        cardKinds(0, ["exercise_created"]),
        noCardLink(0),
        exerciseIs(
          () => ({ name: createName }),
          isCableChest,
          "the exercise was made as described",
        ),
        writesOf("save_custom_exercise"),
      ],
    }),
    define({
      id: "edits-exercise-edit-keeps-a-secondary-muscle",
      messages: [editMessage],
      expect: [
        turnEnded(0, "complete"),
        actionRows("save_custom_exercise", 1),
        cardKinds(0, ["exercise_updated"]),
        noCardLink(0),
        // The id comes from search_exercises: an edit by a made-up id would be not found.
        toolWasCalled("search_exercises"),
        editSavedBy(edited.id),
        exerciseIs(
          edited.id,
          (exercise) =>
            exercise.equipment !== "cable"
              ? "the equipment did not change"
              : exercise.name !== "Scratch dumbbell fly"
                ? "the name changed"
                : hasFlyMuscles(exercise),
          "the equipment changed and the muscle map, with its secondary muscle, is as it was",
        ),
        writesOf("save_custom_exercise"),
      ],
      extras: { setup: async () => (await edited.setup(), null) },
    }),
    define({
      id: "edits-exercise-archive-after-a-yes",
      messages: [archiveMessage(archiveYes.name), archiveButtons.confirmLabel],
      expect: [
        turnEnded(0, "confirm"),
        noActionRowsInTurn(0),
        actionRows("archive_custom_exercise", 1, [1]),
        madeNoModelCall(1),
        cardKinds(1, ["exercise_archived"]),
        noCardLink(1),
        exerciseIs(archiveYes.id, isArchived, "the exercise is archived"),
        writesOf("archive_custom_exercise"),
      ],
      extras: { setup: async () => (await archiveYes.setup(), null) },
    }),
    define({
      id: "edits-exercise-archive-after-a-no",
      messages: [archiveMessage(archiveNo.name), archiveButtons.cancelLabel],
      expect: [
        turnEnded(0, "confirm"),
        actionRows("archive_custom_exercise", 0),
        noActionRowsInTurn(0),
        noActionRowsInTurn(1),
        exerciseIs(archiveNo.id, isLive, "the exercise is still live"),
        writesOf("archive_custom_exercise"),
      ],
      extras: { setup: async () => (await archiveNo.setup(), null) },
    }),
    // An exercise on a routine is not archived and nothing is asked: the tool answers in_use. A reply that says so
    // without calling the tool is as right, so the call is only checked when it was made.
    define({
      id: "edits-exercise-archive-one-in-a-routine-is-refused-without-a-question",
      messages: [archiveMessage(inUse.name)],
      expect: [
        turnEnded(0, "complete"),
        noActionRowsInTurn(0),
        cardKinds(0, []),
        anyOfRoutes([
          [toolNotCalled("archive_custom_exercise")],
          [toolAnswered("archive_custom_exercise", "in_use")],
        ]),
        exerciseIs(inUse.id, isLive, "the exercise is still live"),
        // The words are the tool's, "Take it out of your routines first": the routine is what the person must know.
        answerSays(0, /routine/i, "say the exercise is in a routine"),
        writesOf("archive_custom_exercise"),
      ],
      extras: {
        setup: async () => {
          await inUse.setup();
          const routine = await world().seedRoutine(inUseRoutine.plan);
          await world().putExerciseInRoutine(routine.id, inUse.id().id);
          return null;
        },
        cleanUp: tidyUp,
      },
    }),

    define({
      id: "edits-workout-delete-after-a-yes",
      messages: [deleteMessage(at(FIRST_DELETE_DAY)), deleteButtons.confirmLabel],
      expect: [
        turnEnded(0, "confirm"),
        noActionRowsInTurn(0),
        deleteCallNamed("delete_workout", yes.session(0)),
        actionRows("delete_workout", 1, [1]),
        madeNoModelCall(1),
        cardKinds(1, ["workout_deleted"]),
        workoutDeleted(yes.session(0), true),
        writesOf("delete_workout"),
      ],
      extras: { setup: yes.setup, cleanUp: tidyUp },
    }),
    define({
      id: "edits-workout-delete-after-a-no",
      messages: [deleteMessage(at(1)), deleteButtons.cancelLabel],
      expect: [
        turnEnded(0, "confirm"),
        actionRows("delete_workout", 0),
        noActionRowsInTurn(0),
        noActionRowsInTurn(1),
        workoutDeleted(no.session(0), false),
        writesOf("delete_workout"),
      ],
      extras: { setup: no.setup, cleanUp: tidyUp },
    }),
    // The comment on the ticket: when the model words the question, the person sees its words and not the tool's, so
    // a model that misnames a day could ask about one workout while `session_id` names another, and the press deletes
    // the named one. Two workouts, the newer asked about: the question names the newer day, the call names the newer
    // session, and the older workout is still there afterwards.
    define({
      id: "edits-workout-delete-the-day-in-the-question-is-the-day-deleted",
      messages: [`Delete my workout from ${sayThursday(at(2))}.`, deleteButtons.confirmLabel],
      expect: [
        turnEnded(0, "confirm"),
        confirmationNamesDay(0, at(2), at(3)),
        deleteCallNamed("delete_workout", misnamed.session(0)),
        actionRows("delete_workout", 1, [1]),
        cardKinds(1, ["workout_deleted"]),
        workoutDeleted(misnamed.session(0), true),
        workoutDeleted(misnamed.session(1), false),
        writesOf("delete_workout"),
      ],
      extras: { setup: misnamed.setup, cleanUp: tidyUp },
    }),

    define({
      id: "edits-undo-a-created-exercise",
      messages: [createMessage(createUndoName)],
      expect: [
        actionRows("save_custom_exercise", 1),
        createUndoPress.undone,
        rowCount({ table: "exercises", where: { name: createUndoName, deleted_at: null } }, 0),
        writesOf("save_custom_exercise"),
      ],
      extras: { afterTurn: createUndoPress.afterTurn },
    }),
    define({
      id: "edits-undo-an-edited-exercise",
      messages: ["Change my Scratch dumbbell raise exercise to use a cable instead."],
      expect: [
        actionRows("save_custom_exercise", 1),
        editedUndoPress.undone,
        exerciseIs(
          editedUndo.id,
          (exercise) =>
            exercise.equipment === "dumbbell"
              ? hasFlyMuscles(exercise)
              : "the equipment is not back",
          "the equipment and the muscle map are back as they were",
        ),
        writesOf("save_custom_exercise"),
      ],
      extras: {
        setup: async () => (await editedUndo.setup(), null),
        afterTurn: editedUndoPress.afterTurn,
      },
    }),
    define({
      id: "edits-undo-an-archived-exercise",
      messages: [archiveMessage(archiveUndo.name), archiveButtons.confirmLabel],
      expect: [
        actionRows("archive_custom_exercise", 1),
        archiveUndoPress.undone,
        exerciseIs(archiveUndo.id, isLive, "the exercise is back"),
        writesOf("archive_custom_exercise"),
      ],
      extras: {
        setup: async () => (await archiveUndo.setup(), null),
        afterTurn: archiveUndoPress.afterTurn,
      },
    }),
    // A restore needs nothing but the stamp the delete left. delete_workout keeps no changed-since through the app
    // beyond that restore, so this is its one Undo case: undone, then already undone, and the sets are back.
    define({
      id: "edits-undo-a-deleted-workout",
      messages: [deleteMessage(at(4)), deleteButtons.confirmLabel],
      expect: [
        actionRows("delete_workout", 1),
        undoDeletePress.undone,
        workoutDeleted(undoDelete.session(0), false),
        liveSetsOf(undoDelete.session(0), SQUAT_SETS_OF_A_LEGS_WORKOUT),
        writesOf("delete_workout"),
      ],
      extras: { setup: undoDelete.setup, afterTurn: undoDeletePress.afterTurn, cleanUp: tidyUp },
    }),
    // archive_routine, archive_custom_exercise, update_training_goals and delete_workout keep no previous value, so
    // their Undo works once the conversation is deleted. The actions lose their turn with it, so the ids are read first.
    define({
      id: "edits-undo-after-the-conversation-is-deleted",
      messages: [`Archive my ${stored.name} routine.`, confirmArchiveRoutineButtons().confirmLabel],
      expect: [
        () =>
          Promise.resolve(
            undoneAfterDelete?.length === 1 && undoneAfterDelete[0]?.result === "undone"
              ? {
                  passed: true,
                  reason: "Undo undid the archive after the conversation was deleted",
                }
              : {
                  passed: false,
                  reason: `Undo answered ${undoneAfterDelete?.map((item) => item.result).join(", ") ?? "nothing"} after the conversation was deleted`,
                },
          ),
        routineIs(
          stored.name,
          (routine) => (routine.isArchived ? "the routine is still archived" : null),
          "the routine is back",
        ),
        writesOf("archive_routine"),
      ],
      extras: {
        setup: stored.setup,
        afterTurn: async ({ index, result }) => {
          if (index === 1) {
            const ids = await world().actionIdsOfTurn(result.turnId);
            await world().deleteConversation(result.conversationId);
            undoneAfterDelete = await world().pressUndoFor(ids);
          }
        },
        cleanUp: tidyUp,
      },
    }),
  ];
}

/** The set for a run now: the eval user's today is the UTC date, as the write set takes it. */
export const trainingEditsCases: readonly EvalCase[] = trainingEditsCasesOf(
  new Date().toISOString().slice(0, 10),
);
