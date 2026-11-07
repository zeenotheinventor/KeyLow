import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";

import { muscleStateRows } from "../../core.ts";
import { readMuscleState } from "../../repos.ts";
import { executeTool } from "../executor.ts";
import { createFakeContext, userId } from "../testing.ts";
import { toJsonSchema } from "../tool.ts";
import { getMuscleStateTool } from "./getMuscleState.ts";
import {
  atFixedNow,
  fixedNow,
  fullWeekSets,
  loggedSetRow,
  profileRow,
  rowMuscles,
  trainingTables,
} from "./suggestionFixtures.ts";
import { listOf, payloadOf, stubCaller } from "./testing.ts";

import type { StubData } from "./testing.ts";

async function fetchMuscleState(data: StubData, rawInput: unknown) {
  const { caller, calls } = stubCaller(data);
  const { ctx } = createFakeContext([getMuscleStateTool]);
  const result = await atFixedNow(fixedNow, () =>
    executeTool({ ...ctx, caller }, "get_muscle_state", rawInput),
  );
  return { result, calls, caller };
}

const fieldOf = (result: Awaited<ReturnType<typeof fetchMuscleState>>["result"], key: string) => {
  const payload = payloadOf(result);
  return typeof payload === "object" && payload !== null && key in payload
    ? payload[key as keyof typeof payload]
    : undefined;
};

Deno.test("get_muscle_state is a read tool that says it is read-only and is not strict", () => {
  assertEquals(getMuscleStateTool.kind, "read");
  assertEquals(getMuscleStateTool.annotations, { readOnlyHint: true });
  assertEquals(getMuscleStateTool.strict, false);
});

Deno.test("get_muscle_state says what a row holds, what area does and which week it counts", () => {
  assertStringIncludes(getMuscleStateTool.description, "last 7 days");
  assertStringIncludes(getMuscleStateTool.description, "area");
  assertStringIncludes(getMuscleStateTool.description, "never work one out");
  assertEquals(getMuscleStateTool.description.length < 800, true);
});

Deno.test(
  "the schema of get_muscle_state shows area as required, nullable and the app's groups",
  () => {
    const schema = toJsonSchema(getMuscleStateTool);

    assertEquals(schema["required"], ["area"]);
    assertStringIncludes(JSON.stringify(schema["properties"]), '{"type":"null"}');
    assertStringIncludes(JSON.stringify(schema["properties"]), '"shoulders"');
  },
);

Deno.test("get_muscle_state with no area answers one row for each of the 22 muscles", async () => {
  const { result } = await fetchMuscleState(trainingTables(), { area: null });

  const rows = listOf(result, "muscles");
  assertEquals(rows.length, 22);
  assertEquals(Object.keys(rows[0] ?? {}), [
    "muscle",
    "heat",
    "heat_percent",
    "ready_at",
    "sets",
    "target",
    "status",
  ]);
  assertEquals(fieldOf(result, "area"), null);
  assertEquals(fieldOf(result, "citation"), "Based on your muscles, 8 to 14 Oct");
});

Deno.test("get_muscle_state answers the same when the model leaves area out", async () => {
  const left = await fetchMuscleState(trainingTables(), {});
  const given = await fetchMuscleState(trainingTables(), { area: null });

  assertEquals(payloadOf(left.result), payloadOf(given.result));
});

Deno.test(
  "get_muscle_state gives the rows the body map's hook gives from the same rows",
  async () => {
    const { result, caller } = await fetchMuscleState(trainingTables(), { area: null });

    const states = await readMuscleState(caller, { now: fixedNow, timeZone: "Europe/London" });

    assertEquals(
      listOf(result, "muscles"),
      muscleStateRows(states, { now: fixedNow, timeZone: "Europe/London", area: null }).rows,
    );
  },
);

Deno.test(
  "get_muscle_state with an area gives its muscles and the area's sets and target summed",
  async () => {
    const { result } = await fetchMuscleState(trainingTables(), { area: "back" });

    assertEquals(
      listOf(result, "muscles").map((row) => row["muscle"]),
      ["Lats", "Upper traps", "Mid traps", "Lower back"],
    );
    assertEquals(fieldOf(result, "area"), { name: "back", sets: 20.5, target: 40 });
    assertEquals(fieldOf(result, "citation"), "Based on 20.5 sets for your back, 8 to 14 Oct");
  },
);

Deno.test(
  "get_muscle_state words a muscle's heat, ready time, sets, target and status",
  async () => {
    const { result } = await fetchMuscleState(trainingTables(), { area: "back" });

    assertEquals(listOf(result, "muscles")[0], {
      muscle: "Lats",
      heat: "Very hot",
      heat_percent: 76,
      ready_at: "Thu 23:46",
      sets: 18,
      target: 10,
      status: "Productive",
    });
  },
);

Deno.test("get_muscle_state says now for a muscle that is ready", async () => {
  const { result } = await fetchMuscleState(trainingTables(), { area: "back" });

  assertEquals(listOf(result, "muscles")[1]?.["ready_at"], "now");
});

Deno.test("get_muscle_state says so when the area had no sets", async () => {
  const { result } = await fetchMuscleState(trainingTables({ workout_sets: [] }), {
    area: "neck",
  });

  assertEquals(fieldOf(result, "citation"), "No sets for your neck, 8 to 14 Oct");
  assertEquals(fieldOf(result, "area"), { name: "neck", sets: 0, target: 10 });
});

Deno.test("get_muscle_state counts a set of a workout that is still going", async () => {
  const live = loggedSetRow(500, 0.2, rowMuscles, { ended_at: null });
  const { result } = await fetchMuscleState(trainingTables({ workout_sets: [live] }), {
    area: "back",
  });

  assertEquals(result.status, "ok");
  assertEquals(listOf(result, "muscles")[0]?.["sets"], 1);
});

Deno.test("get_muscle_state reads the days in UTC when the profile has no time zone", async () => {
  const { result } = await fetchMuscleState(
    trainingTables({ profiles: [{ ...profileRow, timezone: null }] }),
    { area: "back" },
  );

  assertEquals(result.status, "ok");
  assertEquals(listOf(result, "muscles")[0]?.["ready_at"], "Thu 22:46");
});

Deno.test("get_muscle_state refuses an area that is not one of the app's groups", async () => {
  const { result } = await fetchMuscleState(trainingTables(), { area: "glutes" });

  assertEquals(result.status, "error");
});

Deno.test(
  "get_muscle_state stays under 4,000 characters after a week that trained every muscle",
  async () => {
    const { result } = await fetchMuscleState(trainingTables({ workout_sets: fullWeekSets() }), {
      area: null,
    });

    assertEquals(result.status, "ok");
    assertEquals(result.text.length < 4_000, true, `${result.text.length} characters`);
  },
);

Deno.test("get_muscle_state leaves out the user id, the muscle map and the raw codes", async () => {
  const { result } = await fetchMuscleState(trainingTables({ workout_sets: fullWeekSets() }), {
    area: null,
  });

  assertFalse(result.text.includes(userId));
  assertFalse(result.text.includes("muscle_id"));
  assertFalse(result.text.includes("snapshot"));
  assertFalse(result.text.includes("not_trained"));
  assertFalse(result.text.includes("readyAt"));
});

Deno.test("get_muscle_state reads the sets and the time zone and nothing else", async () => {
  const { calls } = await fetchMuscleState(trainingTables(), { area: null });

  assertEquals([...new Set(calls.map((call) => call.table))].sort(), ["profiles", "workout_sets"]);
});
