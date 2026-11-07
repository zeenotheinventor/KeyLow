import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";

import {
  addCalendarDays,
  describeProgressCitation,
  describeProgressWeek,
  exerciseWeeklyTrend,
  localToday,
  TREND_RANGE_WEEKS,
  TREND_RANGES,
  trendReadWindow,
} from "../../core.ts";
import { executeTool } from "../executor.ts";
import { createFakeContext, userId } from "../testing.ts";
import { toJsonSchema } from "../tool.ts";
import { getExerciseProgressTool } from "./getExerciseProgress.ts";
import { mondayOf, trendSetRow, trendSetsOf, weeklyRows } from "./progressFixtures.ts";
import { listOf, payloadOf, stubCaller } from "./testing.ts";
import { benchPress, exerciseId, exerciseRow } from "./trainingFixtures.ts";

import type { TrendRange } from "../../core.ts";
import type { ExecutionResult } from "../executor.ts";
import type { StubData } from "./testing.ts";

const timeZone = "Europe/London";
const today = localToday(new Date().toISOString(), timeZone);

const profile = (overrides: Record<string, unknown> = {}) => ({
  timezone: timeZone,
  weight_unit: "kg",
  ...overrides,
});

const benchRow = exerciseRow(1, { name: benchPress.name });

const dataOf = (rows: Record<string, unknown>[], extra: StubData["tables"] = {}): StubData => ({
  tables: { exercises: [benchRow], profiles: [profile()], workout_sets: rows, ...extra },
});

async function fetchProgress(data: StubData, rawInput: unknown) {
  const { caller, calls } = stubCaller(data);
  const { ctx } = createFakeContext([getExerciseProgressTool]);
  const result = await executeTool({ ...ctx, caller }, "get_exercise_progress", rawInput);
  return { result, calls };
}

const askedFor = (range: string) => ({ exercise_id: benchPress.id, range });

const field = (result: ExecutionResult, key: string) => {
  const payload = payloadOf(result);
  return typeof payload === "object" && payload !== null && key in payload
    ? Object.entries(payload).find(([name]) => name === key)?.[1]
    : undefined;
};

const structuredOf = (result: ExecutionResult) =>
  result.status === "ok" ? result.structured : "error";

// What the exercise progress screen's own reader gives for the same rows: the rows of the range's window and
// the last week trained before it, worked out by core's trend, in the screen's words, for the weeks trained.
function screenWeeks(
  rows: ReturnType<typeof trendSetRow>[],
  range: TrendRange,
  unit: "kg" | "lb",
  zone = timeZone,
) {
  const now = new Date().toISOString();
  const { fromWeek, throughDay } = trendReadWindow(range, now, zone);
  const sets = trendSetsOf(rows);
  const before = sets.filter((set) => set.local_date < fromWeek);
  const newestBefore = before
    .map((set) => set.local_date)
    .sort()
    .at(-1);
  const trend = exerciseWeeklyTrend(
    sets.filter((set) => set.local_date >= fromWeek && set.local_date <= throughDay),
    {
      range,
      now,
      timeZone: zone,
      earlier:
        newestBefore === undefined
          ? []
          : before.filter((set) => mondayOf(set.local_date) === mondayOf(newestBefore)),
    },
  );
  return trend.weeks
    .filter((entry) => entry.value !== null)
    .map((entry) => describeProgressWeek(entry, unit))
    .map(({ weekLabel, value, change }) => ({
      week_start: weekLabel,
      best: value,
      change: change?.text,
    }));
}

Deno.test(
  "get_exercise_progress is a read tool that says it is read-only and is not strict",
  () => {
    assertEquals(getExerciseProgressTool.kind, "read");
    assertEquals(getExerciseProgressTool.annotations, { readOnlyHint: true });
    assertEquals(getExerciseProgressTool.strict, false);
  },
);

Deno.test(
  "get_exercise_progress tells the model to say the stall as given and never to suggest a load",
  () => {
    const { description } = getExerciseProgressTool;

    assertStringIncludes(description, "weeks_without_progress");
    assertStringIncludes(description, "never count");
    assertStringIncludes(description, "never suggest a load");
    assertStringIncludes(description, "trained weeks only");
    assertStringIncludes(description, "trained is false");
    assertStringIncludes(description, "stall_may_be_longer");
    assertStringIncludes(description, "since it last rose");
  },
);

Deno.test(
  "the schema of get_exercise_progress offers the three ranges of the progress screen",
  () => {
    const schema = toJsonSchema(getExerciseProgressTool);

    assertEquals(schema["required"], ["exercise_id", "range"]);
    for (const range of TREND_RANGES) {
      assertStringIncludes(JSON.stringify(schema["properties"]), `"${range}"`);
    }
  },
);

for (const range of TREND_RANGES) {
  Deno.test(
    `get_exercise_progress over ${range} answers what the progress screen shows`,
    async () => {
      const rows = weeklyRows(benchPress.id, today, 60, (weeksBack) => 100 - weeksBack);
      const { result } = await fetchProgress(dataOf(rows), askedFor(range));

      const expected = screenWeeks(rows, range, "kg");
      assertEquals(expected.length, TREND_RANGE_WEEKS[range]);
      assertEquals(listOf(result, "weeks"), expected);
    },
  );
}

Deno.test(
  "get_exercise_progress answers 52 short rows for a year of weekly training and nothing more",
  async () => {
    const rows = weeklyRows(benchPress.id, today, 70, (weeksBack) => 120 - weeksBack);
    const { result } = await fetchProgress(dataOf(rows), askedFor("1y"));

    const weeks = listOf(result, "weeks");
    assertEquals(weeks.length, 52);
    for (const week of weeks) {
      assertEquals(Object.keys(week), ["week_start", "best", "change"]);
    }
  },
);

Deno.test(
  "get_exercise_progress leaves the weeks not trained out and compares across the gap",
  async () => {
    const rows = [
      trendSetRow(benchPress.id, addCalendarDays(mondayOf(today), -21), { loadKg: 60, reps: 8 }),
      trendSetRow(benchPress.id, addCalendarDays(mondayOf(today), -7), { loadKg: 62.5, reps: 8 }),
    ];
    const { result } = await fetchProgress(dataOf(rows), askedFor("4w"));

    assertEquals(
      listOf(result, "weeks").map((week) => [week["best"], week["change"]]),
      [
        ["60 kg for 8 reps", "First week"],
        ["62.5 kg for 8 reps", "+2.5 kg"],
      ],
    );
  },
);

Deno.test(
  "get_exercise_progress gives the best set in pounds for a user who shows pounds",
  async () => {
    const rows = [trendSetRow(benchPress.id, mondayOf(today), { loadKg: 100, reps: 5 })];
    const { result } = await fetchProgress(
      dataOf(rows, { profiles: [profile({ weight_unit: "lb" })] }),
      askedFor("4w"),
    );

    assertEquals(listOf(result, "weeks")[0]?.["best"], "220.5 lb for 5 reps");
  },
);

Deno.test("get_exercise_progress words a reps-only exercise as reps", async () => {
  const rows = [
    trendSetRow(benchPress.id, addCalendarDays(mondayOf(today), -7), { loadKg: null, reps: 10 }),
    trendSetRow(benchPress.id, mondayOf(today), { loadKg: null, reps: 12 }),
  ];
  const { result } = await fetchProgress(dataOf(rows), askedFor("4w"));

  assertEquals(
    listOf(result, "weeks").map((week) => [week["best"], week["change"]]),
    [
      ["10 reps", "First week"],
      ["12 reps", "+2 reps"],
    ],
  );
});

Deno.test(
  "get_exercise_progress counts the weeks without progress, so the model never has to",
  async () => {
    const rows = weeklyRows(benchPress.id, today, 5, (weeksBack) => (weeksBack >= 3 ? 55 : 60));
    const { result } = await fetchProgress(dataOf(rows), askedFor("3m"));

    assertEquals(field(result, "weeks_without_progress"), 2);
  },
);

Deno.test(
  "get_exercise_progress says 0 weeks without progress for an exercise that keeps rising",
  async () => {
    const rows = weeklyRows(benchPress.id, today, 5, (weeksBack) => 60 - weeksBack);
    const { result } = await fetchProgress(dataOf(rows), askedFor("3m"));

    assertEquals(field(result, "weeks_without_progress"), 0);
  },
);

Deno.test(
  "get_exercise_progress ignores warm-ups, deleted sets and sets of another exercise",
  async () => {
    const rows = [
      trendSetRow(benchPress.id, mondayOf(today), { loadKg: 60, reps: 8 }),
      trendSetRow(benchPress.id, mondayOf(today), { loadKg: 140, reps: 3 }, { set_type: "warmup" }),
      trendSetRow(
        benchPress.id,
        mondayOf(today),
        { loadKg: 150, reps: 3 },
        { deleted_at: "2026-10-01T00:00:00Z" },
      ),
      trendSetRow(exerciseId(2), mondayOf(today), { loadKg: 200, reps: 1 }),
    ];
    const { result } = await fetchProgress(dataOf(rows), askedFor("4w"));

    assertEquals(
      listOf(result, "weeks").map((week) => week["best"]),
      ["60 kg for 8 reps"],
    );
  },
);

Deno.test(
  "get_exercise_progress words the citation as the board does and hands it to the turn loop",
  async () => {
    const rows = weeklyRows(benchPress.id, today, 3, () => 80);
    const { result } = await fetchProgress(dataOf(rows), askedFor("3m"));

    const trend = exerciseWeeklyTrend(trendSetsOf(rows), {
      range: "3m",
      now: new Date().toISOString(),
      timeZone,
    });
    const citation = describeProgressCitation(benchPress.name, trend);
    assertStringIncludes(citation, "Based on 3 weeks of barbell bench press, ");
    assertEquals(field(result, "citation"), citation);
    assertEquals(structuredOf(result), { citation, estimate: null });
  },
);

Deno.test(
  "get_exercise_progress cleans an exercise name the person wrote before it reaches the citation",
  async () => {
    const rows = [trendSetRow(benchPress.id, mondayOf(today), { loadKg: 60, reps: 8 })];
    const { result } = await fetchProgress(
      dataOf(rows, {
        exercises: [exerciseRow(1, { name: "Cable\n‮FLY\u0000  press", source: "user" })],
      }),
      askedFor("4w"),
    );

    assertStringIncludes(String(field(result, "citation")), "Based on 1 week of cable fly press, ");
  },
);

Deno.test(
  "get_exercise_progress answers trained false, with no citation, for an exercise with no sets",
  async () => {
    const { result } = await fetchProgress(dataOf([]), askedFor("3m"));

    assertEquals(payloadOf(result), { trained: false });
    assertEquals(structuredOf(result), null);
  },
);

Deno.test(
  "get_exercise_progress answers trained false when the sets are all before the range",
  async () => {
    const rows = [
      trendSetRow(benchPress.id, addCalendarDays(mondayOf(today), -7 * 30), {
        loadKg: 60,
        reps: 8,
      }),
    ];
    const { result } = await fetchProgress(dataOf(rows), askedFor("4w"));

    assertEquals(payloadOf(result), { trained: false });
  },
);

Deno.test(
  "get_exercise_progress answers not_found for an exercise the caller cannot see, and reads no set",
  async () => {
    const rows = [trendSetRow(benchPress.id, mondayOf(today), { loadKg: 60, reps: 8 })];
    const { result, calls } = await fetchProgress(dataOf(rows, { exercises: [] }), askedFor("3m"));

    assertEquals(payloadOf(result), { error: "not_found" });
    assertEquals(structuredOf(result), null);
    assertEquals(
      calls.some((call) => call.table === "workout_sets"),
      false,
    );
  },
);

Deno.test("get_exercise_progress reads in UTC for a profile with no time zone", async () => {
  const rows = [
    trendSetRow(benchPress.id, mondayOf(localToday(new Date().toISOString(), "UTC")), {
      loadKg: 60,
      reps: 8,
    }),
  ];
  const { result } = await fetchProgress(
    dataOf(rows, { profiles: [profile({ timezone: null })] }),
    askedFor("4w"),
  );

  assertEquals(listOf(result, "weeks").length, 1);
});

Deno.test("get_exercise_progress uses 3 months when the model leaves the range out", async () => {
  const rows = weeklyRows(benchPress.id, today, 20, () => 80);
  const { result } = await fetchProgress(dataOf(rows), { exercise_id: benchPress.id });

  assertEquals(listOf(result, "weeks").length, TREND_RANGE_WEEKS["3m"]);
});

Deno.test("get_exercise_progress rejects input it does not accept, before any read", async () => {
  const badInputs = [
    { exercise_id: "bench-press", range: "3m" },
    { exercise_id: benchPress.id, range: "5y" },
    { range: "3m" },
    { exercise_id: benchPress.id, range: "3m", include_warmups: true },
    null,
    [],
    "bench press",
  ];

  for (const input of badInputs) {
    const { result, calls } = await fetchProgress(dataOf([]), input);
    assertEquals(
      result.status === "error" ? result.code : null,
      "invalid_input",
      JSON.stringify(input),
    );
    assertEquals(calls, []);
  }
});

Deno.test(
  "get_exercise_progress answers the weeks of the range asked for and nothing else, with no latest field",
  async () => {
    const rows = weeklyRows(benchPress.id, today, 30, (weeksBack) => 100 - weeksBack);
    const { result } = await fetchProgress(dataOf(rows), askedFor("4w"));

    assertEquals(Object.keys(JSON.parse(JSON.stringify(payloadOf(result)))), [
      "trained",
      "weeks",
      "weeks_without_progress",
      "stall_may_be_longer",
      "citation",
    ]);
    assertEquals(listOf(result, "weeks").length, 4);
  },
);

Deno.test(
  "get_exercise_progress counts a stall longer than the range asked for, back to when the best last rose",
  async () => {
    // Flat at 80 kg for the last 20 weeks, after a rise that ended 20 weeks ago: 19 weeks without progress.
    const rows = weeklyRows(benchPress.id, today, 40, (weeksBack) =>
      weeksBack >= 20 ? 60 + (40 - weeksBack) / 2 : 80,
    );

    for (const range of TREND_RANGES) {
      const { result } = await fetchProgress(dataOf(rows), askedFor(range));

      assertEquals(listOf(result, "weeks").length, Math.min(TREND_RANGE_WEEKS[range], 40), range);
      assertEquals(field(result, "weeks_without_progress"), 19, range);
      assertEquals(field(result, "stall_may_be_longer"), false, range);
    }
  },
);

Deno.test(
  "get_exercise_progress says the stall may be longer when it runs back past the year it reads",
  async () => {
    const rows = weeklyRows(benchPress.id, today, 70, () => 80);
    const { result } = await fetchProgress(dataOf(rows), askedFor("4w"));

    assertEquals(listOf(result, "weeks").length, 4);
    assertEquals(field(result, "weeks_without_progress"), 52);
    assertEquals(field(result, "stall_may_be_longer"), true);
  },
);

Deno.test(
  "get_exercise_progress compares the first week of the range with the last week trained before it",
  async () => {
    const rows = [
      trendSetRow(benchPress.id, addCalendarDays(mondayOf(today), -70), { loadKg: 60, reps: 8 }),
      trendSetRow(benchPress.id, mondayOf(today), { loadKg: 62.5, reps: 8 }),
    ];
    const { result } = await fetchProgress(dataOf(rows), askedFor("4w"));

    assertEquals(listOf(result, "weeks"), screenWeeks(rows, "4w", "kg"));
    assertEquals(
      listOf(result, "weeks").map((week) => week["change"]),
      ["+2.5 kg"],
    );
  },
);

Deno.test(
  "get_exercise_progress compares the oldest week of the year with a week trained before the year",
  async () => {
    const rows = [
      trendSetRow(benchPress.id, addCalendarDays(mondayOf(today), -7 * 70), {
        loadKg: 60,
        reps: 8,
      }),
      trendSetRow(benchPress.id, addCalendarDays(mondayOf(today), -7 * 10), {
        loadKg: 80,
        reps: 8,
      }),
    ];
    const { result } = await fetchProgress(dataOf(rows), askedFor("1y"));

    assertEquals(
      listOf(result, "weeks").map((week) => week["change"]),
      ["+20 kg"],
    );
  },
);

// Two zones a day or more apart at every moment, so one of them has a date that UTC does not.
for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
  Deno.test(
    `get_exercise_progress puts a Sunday and the Monday after it in two weeks, and reads today, in ${zone}`,
    async () => {
      const zoneToday = localToday(new Date().toISOString(), zone);
      const monday = mondayOf(zoneToday);
      const rows = [
        trendSetRow(benchPress.id, addCalendarDays(monday, -1), { loadKg: 60, reps: 8 }),
        trendSetRow(benchPress.id, monday, { loadKg: 62.5, reps: 8 }),
        trendSetRow(benchPress.id, zoneToday, { loadKg: 65, reps: 8 }),
      ];
      const { result } = await fetchProgress(
        dataOf(rows, { profiles: [profile({ timezone: zone })] }),
        askedFor("4w"),
      );

      assertEquals(listOf(result, "weeks"), screenWeeks(rows, "4w", "kg", zone));
      assertEquals(
        listOf(result, "weeks").map((week) => [week["best"], week["change"]]),
        [
          ["60 kg for 8 reps", "First week"],
          ["65 kg for 8 reps", "+5 kg"],
        ],
      );
    },
  );
}

Deno.test("get_exercise_progress keeps the user's id out of what the model reads", async () => {
  const rows = weeklyRows(benchPress.id, today, 3, () => 80);
  const { result } = await fetchProgress(dataOf(rows), askedFor("3m"));

  assertFalse(result.text.includes(userId));
});
