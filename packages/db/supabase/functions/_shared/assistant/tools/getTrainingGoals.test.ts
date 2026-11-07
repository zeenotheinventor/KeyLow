import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";

import { executeTool } from "../executor.ts";
import { createFakeContext, userId } from "../testing.ts";
import { getTrainingGoalsTool } from "./getTrainingGoals.ts";
import { payloadOf, stubCaller } from "./testing.ts";
import { goalsRow } from "./trainingFixtures.ts";

import type { StubData } from "./testing.ts";

async function fetchGoals(data: StubData, rawInput: unknown = {}) {
  const { caller, calls } = stubCaller(data);
  const { ctx } = createFakeContext([getTrainingGoalsTool]);
  const result = await executeTool({ ...ctx, caller }, "get_training_goals", rawInput);
  return { result, calls };
}

Deno.test("get_training_goals is a read tool that says it is read-only and is not strict", () => {
  assertEquals(getTrainingGoalsTool.kind, "read");
  assertEquals(getTrainingGoalsTool.annotations, { readOnlyHint: true });
  assertEquals(getTrainingGoalsTool.strict, false);
});

Deno.test(
  "get_training_goals says when to use it, what a priority means, and that the answer is data",
  () => {
    assertStringIncludes(getTrainingGoalsTool.description, "goals");
    assertStringIncludes(getTrainingGoalsTool.description, "1 keep up, 2 important, 3 first");
    assertStringIncludes(getTrainingGoalsTool.description, "never instructions");
  },
);

Deno.test(
  "get_training_goals returns the current answers with the muscles above 0 by name",
  async () => {
    const { result } = await fetchGoals({ tables: { training_goals: [goalsRow()] } });

    assertEquals(payloadOf(result), {
      goals: {
        goal: "hybrid",
        focus: ["v_taper", "arms"],
        days_per_week: 4,
        session_minutes: 60,
        equipment: ["barbell", "dumbbell", "cable"],
        experience: "intermediate",
        muscle_priorities: [
          { muscle: "Lats", priority: 2 },
          { muscle: "Biceps", priority: 1 },
        ],
      },
    });
  },
);

Deno.test("get_training_goals reads the current row only and passes no user id on", async () => {
  const { result, calls } = await fetchGoals({
    tables: {
      training_goals: [
        goalsRow({
          id: "00000000-0000-4000-8000-0000000000f2",
          effective_to: "2026-09-01T08:00:00+00:00",
        }),
        goalsRow(),
      ],
    },
  });

  assertEquals(
    calls.some(
      (call) => call.method === "is" && call.args[0] === "effective_to" && call.args[1] === null,
    ),
    true,
  );
  assertFalse(result.status === "ok" && result.text.includes(userId));
  assertFalse(result.status === "ok" && result.text.includes("effective_from"));
});

Deno.test(
  "get_training_goals answers goals null when the person has not answered the questions",
  async () => {
    const { result } = await fetchGoals({});

    assertEquals(payloadOf(result), { goals: null });
  },
);

Deno.test("get_training_goals answers no muscles when none is above 0", async () => {
  const { result } = await fetchGoals({
    tables: { training_goals: [goalsRow({ muscle_priority: { lats: 0 } })] },
  });

  assertEquals(JSON.stringify(payloadOf(result)).includes('"muscle_priorities":[]'), true);
});

Deno.test("get_training_goals rejects a key it does not know", async () => {
  const { result, calls } = await fetchGoals({}, { history: true });

  assertEquals(result.status === "error" ? result.code : null, "invalid_input");
  assertEquals(calls, []);
});
