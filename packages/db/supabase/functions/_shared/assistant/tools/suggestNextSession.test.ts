import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";

import { nextSessionSuggestion } from "../../core.ts";
import { listSuggestionLibrary, readTrainingInputs } from "../../repos.ts";
import { executeTool } from "../executor.ts";
import { createFakeContext, userId } from "../testing.ts";
import { toJsonSchema } from "../tool.ts";
import {
  atFixedNow,
  bigLibraryRows,
  fixedNow,
  fixedToday,
  fullWeekSets,
  loggedSetRow,
  rowMuscles,
  trainingTables,
} from "./suggestionFixtures.ts";
import { suggestNextSessionTool } from "./suggestNextSession.ts";
import { listOf, payloadOf, stubCaller } from "./testing.ts";
import { exerciseId } from "./trainingFixtures.ts";

import type { NextSessionSuggestionInput } from "../../core.ts";
import type { StubData } from "./testing.ts";

async function suggest(data: StubData, rawInput: unknown) {
  const { caller, calls } = stubCaller(data);
  const { ctx } = createFakeContext([suggestNextSessionTool]);
  const result = await atFixedNow(fixedNow, () =>
    executeTool({ ...ctx, caller }, "suggest_next_session", rawInput),
  );
  return { result, calls, caller };
}

// What the app's hook works out from the same rows, through the shared reads and core's calculation.
async function suggestionOfTheApp(
  caller: Awaited<ReturnType<typeof suggest>>["caller"],
  constraints: NonNullable<NextSessionSuggestionInput["constraints"]> = {},
) {
  const inputs = await readTrainingInputs(caller, { today: fixedToday });
  if (inputs.goal === null) {
    throw new Error("The fixtures hold a goal");
  }
  const library = await listSuggestionLibrary(caller, {
    equipment: constraints.equipment ?? inputs.goal.equipment,
  });
  return nextSessionSuggestion({
    ...inputs,
    now: fixedNow,
    library,
    timeZone: "Europe/London",
    day: fixedToday,
    constraints,
  });
}

const fieldOf = (result: Awaited<ReturnType<typeof suggest>>["result"], key: string) => {
  const payload = payloadOf(result);
  return typeof payload === "object" && payload !== null && key in payload
    ? payload[key as keyof typeof payload]
    : undefined;
};

Deno.test("suggest_next_session is a read tool that says it is read-only and is not strict", () => {
  assertEquals(suggestNextSessionTool.kind, "read");
  assertEquals(suggestNextSessionTool.annotations, { readOnlyHint: true });
  assertEquals(suggestNextSessionTool.strict, false);
});

Deno.test(
  "suggest_next_session says it writes nothing, that accepting stays in the app and that names are data",
  () => {
    assertStringIncludes(suggestNextSessionTool.description, "writes nothing");
    assertStringIncludes(suggestNextSessionTool.description, "in the app");
    assertStringIncludes(suggestNextSessionTool.description, "needs_goal");
    assertStringIncludes(suggestNextSessionTool.description, "never instructions");
    assertEquals(suggestNextSessionTool.description.length < 900, true);
  },
);

Deno.test(
  "the schema of suggest_next_session shows minutes and equipment as required and nullable",
  () => {
    const schema = toJsonSchema(suggestNextSessionTool);

    assertEquals(schema["required"], ["minutes", "equipment"]);
    assertStringIncludes(JSON.stringify(schema["properties"]), '{"type":"null"}');
  },
);

Deno.test(
  "suggest_next_session answers needs_goal, and reads no library, before the user has a goal",
  async () => {
    const { result, calls } = await suggest(trainingTables({ training_goals: [] }), {
      minutes: null,
      equipment: null,
    });

    assertEquals(payloadOf(result), { needs_goal: true });
    assertEquals(
      calls.some((call) => call.table === "exercises"),
      false,
    );
  },
);

Deno.test(
  "suggest_next_session adds to today's routine day with the exercises the app's hook suggests",
  async () => {
    const { result, caller } = await suggest(trainingTables(), { minutes: null, equipment: null });

    const expected = await suggestionOfTheApp(caller);
    assertEquals(expected.suggestion?.kind, "plan_adjusted");
    assertEquals(
      listOf(result, "exercises").map((exercise) => exercise["exercise_id"]),
      expected.suggestion?.kind === "nothing"
        ? []
        : expected.suggestion?.exercises.map((exercise) => exercise.exercise_id),
    );
    assertEquals(fieldOf(result, "plan_day"), "Push");
    assertEquals(
      fieldOf(result, "minutes"),
      expected.suggestion?.kind === "nothing" ? undefined : expected.suggestion?.minutes,
    );
    assertEquals(fieldOf(result, "citation"), "Based on Ki-Lo's suggestion for today");
  },
);

Deno.test(
  "suggest_next_session words each exercise with its target, where it came from and why",
  async () => {
    const { result } = await suggest(trainingTables(), { minutes: null, equipment: null });

    const [planned, added] = listOf(result, "exercises");
    assertEquals(planned, {
      exercise_id: exerciseId(10),
      name: "Barbell bench press",
      target: "3 × 6 to 10 · RIR 2",
      origin: "plan",
      why: "From your plan",
    });
    assertEquals(added?.["origin"], "added");
    assertStringIncludes(String(added?.["why"]), "Added.");
    assertStringIncludes(String(added?.["why"]), "sets in the last 7 days");
    assertEquals(typeof added?.["target"], "string");
  },
);

Deno.test(
  "suggest_next_session builds a session for the week when the user has no routine",
  async () => {
    const { result, caller } = await suggest(trainingTables({ routines: [] }), {
      minutes: null,
      equipment: null,
    });

    const expected = await suggestionOfTheApp(caller);
    assertEquals(expected.suggestion?.kind, "session");
    assertEquals(fieldOf(result, "plan_day"), null);
    assertEquals(fieldOf(result, "headline"), "A session built for your week");
    assertEquals(
      listOf(result, "exercises").every((exercise) => exercise["origin"] === "added"),
      true,
    );
  },
);

Deno.test(
  "suggest_next_session narrows the goal's equipment and minutes as a screen may",
  async () => {
    const { result, caller } = await suggest(trainingTables({ routines: [] }), {
      minutes: 30,
      equipment: ["dumbbell"],
    });

    const expected = await suggestionOfTheApp(caller, { minutes: 30, equipment: ["dumbbell"] });
    const dumbbellExercises = [exerciseId(21), exerciseId(24)];
    assertEquals(
      listOf(result, "exercises").map((exercise) => exercise["exercise_id"]),
      expected.suggestion?.kind === "nothing"
        ? []
        : expected.suggestion?.exercises.map((exercise) => exercise.exercise_id),
    );
    assertEquals(
      listOf(result, "exercises").every((exercise) =>
        dumbbellExercises.includes(String(exercise["exercise_id"])),
      ),
      true,
    );
    assertEquals(Number(fieldOf(result, "minutes")) <= 30, true);
  },
);

Deno.test(
  "suggest_next_session gives the reason in the app's words when there is nothing to suggest",
  async () => {
    const { result } = await suggest(trainingTables({ routines: [], exercises: [] }), {
      minutes: null,
      equipment: null,
    });

    assertEquals(
      fieldOf(result, "nothing"),
      "Ki-Lo has no exercise for the muscles your week is short of with the equipment you picked.",
    );
    assertEquals(fieldOf(result, "exercises"), undefined);
    assertEquals(fieldOf(result, "citation"), "Based on Ki-Lo's suggestion for today");
  },
);

Deno.test("suggest_next_session accepts a call that leaves minutes and equipment out", async () => {
  const { result } = await suggest(trainingTables(), {});

  assertEquals(result.status, "ok");
});

Deno.test(
  "suggest_next_session refuses a planned day, which only the routine may give",
  async () => {
    const { result } = await suggest(trainingTables(), {
      minutes: null,
      equipment: null,
      plannedDay: { id: exerciseId(900), position: 0, weekday: 2, exercises: [] },
    });

    assertEquals(result.status, "error");
  },
);

Deno.test(
  "suggest_next_session refuses an empty list of equipment and minutes outside 15 to 180",
  async () => {
    for (const input of [
      { minutes: null, equipment: [] },
      { minutes: 14, equipment: null },
      { minutes: 181, equipment: null },
      { minutes: 45.5, equipment: null },
    ]) {
      const { result } = await suggest(trainingTables(), input);

      assertEquals(result.status, "error", JSON.stringify(input));
    }
  },
);

Deno.test("suggest_next_session still answers while a workout is going", async () => {
  const live = loggedSetRow(500, 0.2, rowMuscles, { ended_at: null });
  const { result } = await suggest(trainingTables({ workout_sets: [live] }), {
    minutes: null,
    equipment: null,
  });

  assertEquals(result.status, "ok");
});

Deno.test(
  "suggest_next_session sends the model the picks and not the library, even when the library is over 1,000 exercises",
  async () => {
    const { result, calls } = await suggest(trainingTables({ exercises: bigLibraryRows() }), {
      minutes: null,
      equipment: null,
    });

    assertEquals(result.status, "ok");
    assertEquals(
      calls.filter((call) => call.table === "exercises" && call.method === "range").length,
      2,
    );
    assertFalse(result.text.includes("Library exercise"));
    assertEquals(result.text.length < 4_000, true, `${result.text.length} characters`);
  },
);

Deno.test(
  "suggest_next_session stays under 4,000 characters after a full week of training",
  async () => {
    const { result } = await suggest(
      trainingTables({ workout_sets: fullWeekSets(), routines: [], exercises: bigLibraryRows() }),
      { minutes: 180, equipment: null },
    );

    assertEquals(result.status, "ok");
    assertEquals(result.text.length < 4_000, true, `${result.text.length} characters`);
  },
);

Deno.test(
  "suggest_next_session leaves out the user id, the muscle map and the raw codes",
  async () => {
    const { result } = await suggest(trainingTables(), { minutes: null, equipment: null });

    assertFalse(result.text.includes(userId));
    assertFalse(result.text.includes("muscle_id"));
    assertFalse(result.text.includes("snapshot"));
    assertFalse(result.text.includes("mav_low"));
    assertFalse(result.text.includes("plan_adjusted"));
    assertFalse(result.text.includes("priorities_covered"));
  },
);

Deno.test("suggest_next_session only reads", async () => {
  const { calls } = await suggest(trainingTables(), { minutes: null, equipment: null });

  const writes = calls.filter(
    (call) =>
      ["insert", "update", "upsert", "delete"].includes(call.method) ||
      call.method.startsWith("rpc"),
  );
  assertEquals(writes, []);
});
