import { describeRoutineRule } from "@keylow/core/copy";
import { validateRoutineDraft } from "@keylow/core/training";

import type { RoutineDraft, RoutineDraftIssue } from "@keylow/core/training";

/** The sentences under an exercise's fields, and the one line under its row that says them all. */
export type ExerciseMarks = Readonly<{
  sets: string | undefined;
  reps: string | undefined;
  rir: string | undefined;
  line: string;
}>;

/** What is marked on a day: its header (weekday), its name field, and its exercises by position (undefined for one with no problem). */
export type DayMarks = Readonly<{
  header: string | undefined;
  name: string | undefined;
  exercises: readonly (ExerciseMarks | undefined)[];
}>;

/**
 * Where a draft's problems are marked, in the places the `routines · invalid` board marks them, and how
 * many places that is, which the banner counts: the name, a day's weekday or name, an exercise's row. An
 * exercise row with two problems (its sets and its reps) is one place with one line, as the board draws it.
 */
export type RoutineMarks = Readonly<{
  count: number;
  name: string | undefined;
  /** A problem with the days as a whole. The editor stops at the most days, so this is only ever a safety net. */
  daysMessage: string | undefined;
  days: readonly DayMarks[];
}>;

type Sentences = Partial<Record<"sets" | "reps" | "rir", string[]>>;

const join = (sentences: readonly string[] | undefined): string | undefined =>
  sentences === undefined ? undefined : sentences.join(" ");

function exerciseMarksOf(sentences: Sentences | undefined): ExerciseMarks | undefined {
  if (sentences === undefined) {
    return undefined;
  }
  const marks = {
    sets: join(sentences.sets),
    reps: join(sentences.reps),
    rir: join(sentences.rir),
  };
  return {
    ...marks,
    line: [marks.sets, marks.reps, marks.rir].filter((part) => part !== undefined).join(" "),
  };
}

const EXERCISE_FIELD_OF_PATH: Record<string, keyof Sentences | undefined> = {
  target_sets: "sets",
  rep_min: "reps",
  rep_max: "reps",
  target_rir: "rir",
};

/** Marks the issues `validateRoutineDraft` found, each with core's sentence for its rule and never a value from the draft. */
function marksOfIssues(draft: RoutineDraft, issues: readonly RoutineDraftIssue[]): RoutineMarks {
  let name: string | undefined;
  let daysMessage: string | undefined;
  const headers: (string | undefined)[] = draft.days.map(() => undefined);
  const dayNames: (string | undefined)[] = draft.days.map(() => undefined);
  const exercises = draft.days.map(() => new Map<number, Sentences>());

  for (const { path, rule } of issues) {
    const [, dayIndex, section, exerciseIndex, field] = path;
    const day = typeof dayIndex === "number" ? draft.days[dayIndex] : undefined;
    const sentence = describeRoutineRule(rule, day?.weekday ?? null);

    if (day === undefined || typeof dayIndex !== "number") {
      if (path[0] === "name") {
        name = sentence;
      } else {
        daysMessage = sentence;
      }
    } else if (section === "name") {
      dayNames[dayIndex] = sentence;
    } else if (section === "weekday" || section === "exercises") {
      if (typeof exerciseIndex !== "number" || typeof field !== "string") {
        // The weekday, or a day with too many exercises: both sit under the day's header.
        headers[dayIndex] = [headers[dayIndex], sentence].filter(Boolean).join(" ");
      } else {
        const group = EXERCISE_FIELD_OF_PATH[field];
        const marked = exercises[dayIndex]?.get(exerciseIndex) ?? {};
        if (group !== undefined) {
          marked[group] = [...(marked[group] ?? []), sentence];
          exercises[dayIndex]?.set(exerciseIndex, marked);
        }
      }
    }
  }

  const days = draft.days.map((day, dayIndex): DayMarks => ({
    header: headers[dayIndex],
    name: dayNames[dayIndex],
    exercises: day.exercises.map((_, exerciseIndex) =>
      exerciseMarksOf(exercises[dayIndex]?.get(exerciseIndex)),
    ),
  }));

  const count =
    [name, daysMessage].filter((mark) => mark !== undefined).length +
    days.reduce(
      (total, day) =>
        total +
        [day.header, day.name].filter((mark) => mark !== undefined).length +
        day.exercises.filter((marks) => marks !== undefined).length,
      0,
    );

  return { count, name, daysMessage, days };
}

/** The marks for a draft: none anywhere when it can be saved. */
export function routineMarksOf(draft: RoutineDraft): RoutineMarks {
  const checked = validateRoutineDraft(draft);
  return marksOfIssues(draft, checked.ok ? [] : checked.problems);
}
