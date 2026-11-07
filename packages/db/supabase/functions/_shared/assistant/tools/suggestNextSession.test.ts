import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";

import { SUGGESTION_NO_GOAL, nextSessionSuggestion } from "../../core.ts";
import { listSuggestionLibrary, readTrainingInputs } from "../../repos.ts";
import { executeTool } from "../executor.ts";
import { createFakeContext, userId } from "../testing.ts";
import { toJsonSchema } from "../tool.ts";
import {
  acceptedSuggestionRow,
  atFixedNow,
  bigLibraryRows,
  fixedNow,
  fixedToday,
  fullWeekSets,
  loggedSetRow,
  rowMuscles,
  routineWithDay,
  sessionRow,
  trainingTables,
} from "./suggestionFixtures.ts";
import { suggestNextSessionTool } from "./suggestNextSession.ts";
import { listOf, payloadOf, stubCaller } from "./testing.ts";
import { exerciseId } from "./trainingFixtures.ts";

import type { NextSessionSuggestionInput } from "../../core.ts";
import type { StubData } from "./testing.ts";

const thursday = "2026-10-15";
const nextWednesday = "2026-10-21";

// A finished session from the week before, so the user has history, and today is no part of it.
const earlierSession = sessionRow({
  id: "00000000-0000-4000-8000-0000000000e3",
  local_date: "2026-10-10",
  routine_day_id: null,
  started_at: "2026-10-10T08:00:00+00:00",
  ended_at: "2026-10-10T09:00:00+00:00",
});

async function suggest(data: StubData, rawInput: unknown = { minutes: null, equipment: null }) {
  const { caller, calls } = stubCaller(data);
  const { ctx } = createFakeContext([suggestNextSessionTool]);
  const result = await atFixedNow(fixedNow, () =>
    executeTool({ ...ctx, caller }, "suggest_next_session", rawInput),
  );
  return { result, calls, caller };
}

// What the Today card's suggestion is for the day the card asks for: core's calculation over the shared
// reads, with the day named here and not worked out by the tool.
async function suggestionOfTheCard(
  caller: Awaited<ReturnType<typeof suggest>>["caller"],
  day: string,
  constraints: NonNullable<NextSessionSuggestionInput["constraints"]> = {},
) {
  const inputs = await readTrainingInputs(caller, { today: fixedToday });
  if (inputs.goal === null) {
    throw new Error("The fixtures hold a goal");
  }
  const library = await listSuggestionLibrary(caller, {
    equipment: constraints.equipment ?? inputs.goal.equipment,
  });
  const read = nextSessionSuggestion({
    ...inputs,
    now: fixedNow,
    library,
    timeZone: "Europe/London",
    day,
    constraints,
  });
  if (read.suggestion === null || read.suggestion.kind === "nothing") {
    throw new Error("The fixtures give a suggestion");
  }
  return read.suggestion;
}

const fieldOf = (result: Awaited<ReturnType<typeof suggest>>["result"], key: string) => {
  const payload = payloadOf(result);
  return typeof payload === "object" && payload !== null && key in payload
    ? payload[key as keyof typeof payload]
    : undefined;
};

const exerciseIdsOf = (result: Awaited<ReturnType<typeof suggest>>["result"]) =>
  listOf(result, "exercises").map((exercise) => exercise["exercise_id"]);

Deno.test("suggest_next_session is a read tool that says it is read-only and is not strict", () => {
  assertEquals(suggestNextSessionTool.kind, "read");
  assertEquals(suggestNextSessionTool.annotations, { readOnlyHint: true });
  assertEquals(suggestNextSessionTool.strict, false);
});

Deno.test(
  "suggest_next_session says it follows the Today card, writes nothing, and differs from the card when narrowed",
  () => {
    const { description } = suggestNextSessionTool;

    assertStringIncludes(description, "Today card");
    assertStringIncludes(description, "writes nothing");
    assertStringIncludes(description, "in the app");
    assertStringIncludes(description, "limited_to");
    assertStringIncludes(description, "is_rest_day");
    assertStringIncludes(description, "in_progress");
    assertStringIncludes(description, "never instructions");
    assertFalse(description.includes("for today,"));
    assertEquals(description.length < 1_300, true, `${description.length} characters`);
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
  "suggest_next_session answers needs_goal in the app's words, and reads no library, before the user has a goal",
  async () => {
    const { result, calls } = await suggest(trainingTables({ training_goals: [] }));

    assertEquals(payloadOf(result), {
      needs_goal: true,
      title: SUGGESTION_NO_GOAL.title,
      body: SUGGESTION_NO_GOAL.body,
      where: "The goal is set on the Train tab.",
    });
    assertEquals(
      calls.some((call) => call.table === "exercises"),
      false,
    );
  },
);

Deno.test(
  "suggest_next_session adds to today's routine day when today is a planned day",
  async () => {
    const { result, caller } = await suggest(trainingTables());

    const expected = await suggestionOfTheCard(caller, fixedToday);
    assertEquals(expected.kind, "plan_adjusted");
    assertEquals(
      exerciseIdsOf(result),
      expected.exercises.map((exercise) => exercise.exercise_id),
    );
    assertEquals(fieldOf(result, "minutes"), expected.minutes);
    assertEquals(fieldOf(result, "day"), "today");
    assertEquals(fieldOf(result, "plan_day"), "Push");
    assertEquals(fieldOf(result, "is_rest_day"), false);
    assertEquals(fieldOf(result, "citation"), "Based on Ki-Lo's suggestion for today");
  },
);

Deno.test(
  "suggest_next_session words each exercise with its target, where it came from and why",
  async () => {
    const { result } = await suggest(trainingTables());

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
  },
);

Deno.test(
  "suggest_next_session asks for the next planned day on a rest day, as the Today card does, and says it is a rest day",
  async () => {
    const { result, caller } = await suggest(
      trainingTables({ routines: [routineWithDay(3, "Legs")] }),
    );

    const expected = await suggestionOfTheCard(caller, thursday);
    assertEquals(expected.kind, "plan_adjusted");
    assertEquals(
      exerciseIdsOf(result),
      expected.exercises.map((exercise) => exercise.exercise_id),
    );
    assertEquals(fieldOf(result, "is_rest_day"), true);
    assertEquals(fieldOf(result, "day"), "Thursday");
    assertEquals(fieldOf(result, "plan_day"), "Legs");
    assertEquals(fieldOf(result, "citation"), "Based on Ki-Lo's suggestion for Thursday");
  },
);

Deno.test(
  "suggest_next_session says today is done and gives the next planned day's suggestion once today's session is finished",
  async () => {
    const { result, caller } = await suggest(trainingTables({ workout_sessions: [sessionRow()] }));

    const expected = await suggestionOfTheCard(caller, nextWednesday);
    assertEquals(fieldOf(result, "done_today"), true);
    assertEquals(fieldOf(result, "day"), "Wednesday");
    assertEquals(
      exerciseIdsOf(result),
      expected.exercises.map((exercise) => exercise.exercise_id),
    );
    assertEquals(fieldOf(result, "citation"), "Based on Ki-Lo's suggestion for Wednesday");
  },
);

Deno.test(
  "suggest_next_session gives no new suggestion while a workout is in progress, and reads no library",
  async () => {
    const { result, calls } = await suggest(
      trainingTables({ workout_sessions: [sessionRow({ ended_at: null })] }),
    );

    assertEquals(payloadOf(result), { in_progress: true });
    assertEquals(
      calls.some((call) => call.table === "exercises"),
      false,
    );
  },
);

Deno.test(
  "suggest_next_session gives the stored plan, not a new one, once the day's suggestion is accepted",
  async () => {
    const { result, calls } = await suggest(
      trainingTables({ accepted_suggestions: [acceptedSuggestionRow()] }),
    );

    assertEquals(fieldOf(result, "accepted"), true);
    assertEquals(fieldOf(result, "day"), "today");
    assertEquals(fieldOf(result, "headline"), "Today's Push: 6 sets");
    assertEquals(
      fieldOf(result, "detail"),
      "Now with 3 sets of barbell row. They count as planned.",
    );
    assertEquals(listOf(result, "exercises"), [{ name: "Barbell Row", sets: 3 }]);
    assertEquals(fieldOf(result, "citation"), "Based on Ki-Lo's suggestion for today");
    assertEquals(
      calls.some((call) => call.table === "exercises"),
      false,
    );
  },
);

Deno.test(
  "suggest_next_session builds a session for tomorrow when the user has history and no routine",
  async () => {
    const { result, caller } = await suggest(
      trainingTables({ routines: [], workout_sessions: [earlierSession] }),
    );

    const expected = await suggestionOfTheCard(caller, thursday);
    assertEquals(expected.kind, "session");
    assertEquals(fieldOf(result, "plan_day"), null);
    assertEquals(fieldOf(result, "day"), "Thursday");
    assertEquals(fieldOf(result, "headline"), "A session built for your week");
    assertEquals(
      exerciseIdsOf(result),
      expected.exercises.map((exercise) => exercise.exercise_id),
    );
  },
);

Deno.test(
  "suggest_next_session says it is a first visit, and suggests nothing, with no routine and nothing logged",
  async () => {
    const { result } = await suggest(trainingTables({ routines: [], workout_sets: [] }));

    assertEquals(payloadOf(result), { first_visit: true });
  },
);

Deno.test("suggest_next_session narrows the goal's equipment and minutes and says so", async () => {
  const { result, caller } = await suggest(trainingTables(), {
    minutes: 30,
    equipment: ["dumbbell"],
  });

  const expected = await suggestionOfTheCard(caller, fixedToday, {
    minutes: 30,
    equipment: ["dumbbell"],
  });
  assertEquals(
    exerciseIdsOf(result),
    expected.exercises.map((exercise) => exercise.exercise_id),
  );
  assertEquals(fieldOf(result, "limited_to"), { minutes: 30, equipment: ["dumbbell"] });
  assertEquals(Number(fieldOf(result, "minutes")) <= 30, true);
});

Deno.test("suggest_next_session leaves limited_to out when nothing is narrowed", async () => {
  const { result } = await suggest(trainingTables());

  assertEquals(fieldOf(result, "limited_to"), undefined);
});

Deno.test(
  "suggest_next_session says why when the narrowed equipment is none of the goal's",
  async () => {
    const { result } = await suggest(trainingTables(), {
      minutes: null,
      equipment: ["kettlebell"],
    });

    assertStringIncludes(
      String(fieldOf(result, "nothing")),
      "Your goal's equipment does not include",
    );
    assertEquals(fieldOf(result, "limited_to"), { minutes: null, equipment: ["kettlebell"] });
  },
);

Deno.test(
  "suggest_next_session gives the reason in the app's words when there is nothing to suggest",
  async () => {
    const { result } = await suggest(trainingTables({ exercises: [] }));

    assertEquals(
      fieldOf(result, "nothing"),
      "Ki-Lo has no exercise for the muscles your week is short of with the equipment you picked. Train as planned.",
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
  "suggest_next_session drops a planned day and any other key it was not given, and answers as without them",
  async () => {
    const plain = await suggest(trainingTables());
    const extra = await suggest(trainingTables(), {
      minutes: null,
      equipment: null,
      plannedDay: { id: exerciseId(900), position: 0, weekday: 2, exercises: [] },
      surprise: true,
    });

    assertEquals(extra.result.status, "ok");
    assertEquals(payloadOf(extra.result), payloadOf(plain.result));
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

Deno.test(
  "suggest_next_session still answers while a workout is going, with the advice that none is suggested",
  async () => {
    const live = loggedSetRow(500, 0.2, rowMuscles, { ended_at: null });
    const { result } = await suggest(
      trainingTables({ workout_sets: [live], workout_sessions: [sessionRow({ ended_at: null })] }),
    );

    assertEquals(result.status, "ok");
  },
);

Deno.test(
  "suggest_next_session sends the model the picks and not the library, even when the library is over 1,000 exercises",
  async () => {
    const { result, calls } = await suggest(trainingTables({ exercises: bigLibraryRows() }));

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
      trainingTables({ workout_sets: fullWeekSets(), exercises: bigLibraryRows() }),
      { minutes: 180, equipment: null },
    );

    assertEquals(result.status, "ok");
    assertEquals(result.text.length < 4_000, true, `${result.text.length} characters`);
  },
);

Deno.test(
  "suggest_next_session leaves out the user id, the muscle map and the raw codes",
  async () => {
    const { result } = await suggest(trainingTables());

    assertFalse(result.text.includes(userId));
    assertFalse(result.text.includes("muscle_id"));
    assertFalse(result.text.includes("snapshot"));
    assertFalse(result.text.includes("mav_low"));
    assertFalse(result.text.includes("plan_adjusted"));
    assertFalse(result.text.includes("priorities_covered"));
  },
);

Deno.test("suggest_next_session only reads", async () => {
  const { calls } = await suggest(trainingTables());

  const writes = calls.filter(
    (call) =>
      ["insert", "update", "upsert", "delete"].includes(call.method) ||
      call.method.startsWith("rpc"),
  );
  assertEquals(writes, []);
});
