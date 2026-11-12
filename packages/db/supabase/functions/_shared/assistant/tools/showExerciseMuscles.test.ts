import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";

import { assistantExerciseMusclesSchema, describeRoleRow, musclesByRole } from "../../core.ts";
import { executeTool } from "../executor.ts";
import { createFakeContext } from "../testing.ts";
import { toJsonSchema } from "../tool.ts";
import { dataNotice } from "./shared.ts";
import { showExerciseMusclesTool } from "./showExerciseMuscles.ts";
import { payloadOf, stubCaller } from "./testing.ts";
import { exerciseId, exerciseRow } from "./trainingFixtures.ts";

import type { ExecutionResult } from "../executor.ts";
import type { StubData } from "./testing.ts";

const romanianDeadlift = exerciseRow(1, {
  name: "Romanian Deadlift",
  exercise_muscles: [
    { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
    { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
    { muscle_id: "hamstrings", role: "primary", weight: 1 },
    { muscle_id: "lower_back", role: "secondary", weight: 0.5 },
  ],
});

const dataOf = (...rows: Record<string, unknown>[]): StubData => ({ tables: { exercises: rows } });

async function showMuscles(data: StubData, rawInput: unknown) {
  const { caller, calls } = stubCaller(data);
  const { ctx } = createFakeContext([showExerciseMusclesTool]);
  const result = await executeTool({ ...ctx, caller }, "show_exercise_muscles", rawInput);
  return { result, calls };
}

const askedFor = (id: string) => ({ exercise_id: id });

const structuredOf = (result: ExecutionResult) =>
  result.status === "ok" ? result.structured : "error";

Deno.test(
  "show_exercise_muscles is a read tool that says it is read-only and is not strict",
  () => {
    assertEquals(showExerciseMusclesTool.kind, "read");
    assertEquals(showExerciseMusclesTool.annotations, { readOnlyHint: true });
    assertEquals(showExerciseMusclesTool.strict, false);
  },
);

Deno.test(
  "show_exercise_muscles does not refuse during a workout, because it writes nothing",
  () => {
    assertEquals("refusesDuringWorkout" in showExerciseMusclesTool, false);
  },
);

Deno.test(
  "show_exercise_muscles takes one exercise id and tells the model what the app does",
  () => {
    const schema = toJsonSchema(showExerciseMusclesTool);
    assertEquals(Object.keys(schema["properties"] ?? {}), ["exercise_id"]);
    assertEquals(schema["required"], ["exercise_id"]);
    const { description } = showExerciseMusclesTool;
    assertStringIncludes(description, "Call it once per exercise");
    assertStringIncludes(description, "never an invented one");
    assertStringIncludes(description, "draws the figure under your reply");
    assertStringIncludes(description, "no ranking between exercises");
    assertStringIncludes(description, "not_found");
    assertStringIncludes(description, dataNotice);
  },
);

Deno.test(
  "show_exercise_muscles gives the model the role lines the card draws, and no id or weight",
  async () => {
    const { result } = await showMuscles(dataOf(romanianDeadlift), askedFor(exerciseId(1)));

    assertEquals(payloadOf(result), {
      exercise: "Romanian Deadlift",
      roles: [
        { muscles: "Hamstrings", role: "Primary · counts 1 set" },
        { muscles: "Lower back, Glutes", role: "Secondary · counts half" },
        { muscles: "Calves", role: "Assisting · counts a fifth" },
      ],
    });
    for (const hidden of [exerciseId(1), "weight", "hamstrings", "glute_max", "lower_back"]) {
      assertFalse(result.text.includes(hidden), hidden);
    }
  },
);

Deno.test(
  "show_exercise_muscles words its lines from the same map and functions as the card",
  async () => {
    const muscles = [
      { muscle_id: "hamstrings", role: "primary" },
      { muscle_id: "glute_max", role: "secondary" },
      { muscle_id: "lower_back", role: "secondary" },
      { muscle_id: "calves", role: "stabiliser" },
    ] as const;
    const { result } = await showMuscles(dataOf(romanianDeadlift), askedFor(exerciseId(1)));

    assertEquals(payloadOf(result), {
      exercise: "Romanian Deadlift",
      roles: musclesByRole(muscles).map((row) => describeRoleRow(row.role, row.muscles)),
    });
  },
);

Deno.test("show_exercise_muscles hands the app each muscle id and role and no weight", async () => {
  const { result } = await showMuscles(dataOf(romanianDeadlift), askedFor(exerciseId(1)));

  const structured = structuredOf(result);
  assertEquals(structured, {
    exerciseMuscles: {
      exerciseName: "Romanian Deadlift",
      muscles: [
        { muscle_id: "lower_back", role: "secondary" },
        { muscle_id: "glute_max", role: "secondary" },
        { muscle_id: "hamstrings", role: "primary" },
        { muscle_id: "calves", role: "stabiliser" },
      ],
    },
  });
  // The app's strict schema refuses an extra key, so the value must parse as the event carries it.
  assertEquals(
    assistantExerciseMusclesSchema.safeParse(
      typeof structured === "object" && structured !== null && "exerciseMuscles" in structured
        ? structured.exerciseMuscles
        : null,
    ).success,
    true,
  );
});

Deno.test("show_exercise_muscles sends no citation or estimate beside the figure", async () => {
  const { result } = await showMuscles(dataOf(romanianDeadlift), askedFor(exerciseId(1)));

  const structured = structuredOf(result);
  assertEquals(
    typeof structured === "object" && structured !== null ? Object.keys(structured) : [],
    ["exerciseMuscles"],
  );
});

Deno.test(
  "show_exercise_muscles answers not_found, with no figure, when the caller cannot see the exercise",
  async () => {
    // Another person's custom exercise, an archived one and one that does not exist look the same: no row.
    const { result } = await showMuscles(dataOf(romanianDeadlift), askedFor(exerciseId(2)));

    assertEquals(payloadOf(result), { error: "not_found" });
    assertEquals(structuredOf(result), null);
  },
);

Deno.test("show_exercise_muscles reads the exercise through the caller's own client", async () => {
  const { calls } = await showMuscles(dataOf(romanianDeadlift), askedFor(exerciseId(1)));

  assertEquals([...new Set(calls.map((call) => call.table))], ["exercises"]);
});

Deno.test("show_exercise_muscles rejects input it does not accept, before any read", async () => {
  const badInputs = [
    { exercise_id: "romanian-deadlift" },
    {},
    { exercise_id: exerciseId(1), side: "back" },
    { exercise_ids: [exerciseId(1)] },
    null,
    [],
    "romanian deadlift",
  ];

  for (const input of badInputs) {
    const { result, calls } = await showMuscles(dataOf(romanianDeadlift), input);
    assertEquals(
      result.status === "error" ? result.code : null,
      "invalid_input",
      JSON.stringify(input),
    );
    assertEquals(calls, []);
  }
});
