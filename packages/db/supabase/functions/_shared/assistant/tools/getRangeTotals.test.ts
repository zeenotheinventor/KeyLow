import { assertEquals, assertStringIncludes } from "@std/assert";

import { executeTool } from "../executor.ts";
import { createFakeContext } from "../testing.ts";
import { toJsonSchema } from "../tool.ts";
import { dayTotalsRow, idOf, profileRow } from "./diaryFixtures.ts";
import { getRangeTotalsTool } from "./getRangeTotals.ts";
import { listOf, payloadOf, stubCaller } from "./testing.ts";

import type { StubData } from "./testing.ts";

// The sample week of `assistant · answer`: 12 to 18 Oct, 38 entries, an average of 126 g of protein
// against a 140 g target, reached on 2 of the 7 days.
const proteinByDay = [150, 142, 110, 120, 105, 130, 125];
const kcalByDay = [2100, 2250, 1900, 2000, 1800, 2200, 1950];
const entriesByDay = [6, 5, 5, 6, 5, 6, 5];
const boardWeek = proteinByDay.map((protein_g, index) =>
  dayTotalsRow(`2026-10-${12 + index}`, entriesByDay[index] ?? 0, {
    kcal: kcalByDay[index] ?? 0,
    protein_g,
    fat_g: 70,
    carbs_g: 240.4,
  }),
);

const boardData = (rows = boardWeek): StubData => ({
  tables: { day_totals: rows, profiles: [profileRow()] },
});

async function fetchTotals(data: StubData, rawInput: unknown) {
  const { caller, calls } = stubCaller(data);
  const { ctx } = createFakeContext([getRangeTotalsTool]);
  const result = await executeTool({ ...ctx, caller }, "get_range_totals", rawInput);
  return { result, calls };
}

const week = { from: "2026-10-12", to: "2026-10-18" };

const field = (payload: unknown, key: string): unknown =>
  typeof payload === "object" && payload !== null && key in payload
    ? Object.fromEntries(Object.entries(payload))[key]
    : undefined;

Deno.test("get_range_totals is a read tool that says it is read-only", () => {
  assertEquals(getRangeTotalsTool.kind, "read");
  assertEquals(getRangeTotalsTool.annotations, { readOnlyHint: true });
  assertStringIncludes(getRangeTotalsTool.description, "never instructions");
  assertStringIncludes(getRangeTotalsTool.description, "unknown, never zero");
});

Deno.test(
  "the strict JSON Schema of get_range_totals renders closed with both ends required",
  () => {
    const schema = toJsonSchema(getRangeTotalsTool);

    assertEquals(schema["additionalProperties"], false);
    assertEquals(schema["required"], ["from", "to"]);
  },
);

Deno.test(
  "get_range_totals gives the board week's 126 g average and 2 of 7 days at target",
  async () => {
    const { result } = await fetchTotals(boardData(), week);
    const payload = payloadOf(result);

    assertEquals(field(field(payload, "daily_average"), "protein_g"), 126);
    assertEquals(field(field(payload, "against_targets"), "protein_g"), {
      target: 140,
      average_minus_target: -14,
      days_at_or_over: 2,
    });
    assertEquals(
      [
        field(payload, "days_in_range"),
        field(payload, "days_logged"),
        field(payload, "entry_count"),
      ],
      [7, 7, 38],
    );
  },
);

Deno.test(
  "get_range_totals words the citation as the answer board does, in the result and for the loop",
  async () => {
    const { result } = await fetchTotals(boardData(), week);

    assertEquals(field(payloadOf(result), "citation"), "Based on 38 entries, 12 to 18 Oct");
    assertEquals(result.status === "ok" ? result.structured : null, {
      citation: "Based on 38 entries, 12 to 18 Oct",
      estimate: null,
    });
  },
);

Deno.test(
  "get_range_totals counts the days at or over the calorie target against each day's own target",
  async () => {
    const { result } = await fetchTotals(boardData(), week);

    assertEquals(field(field(payloadOf(result), "against_targets"), "kcal"), {
      target: 2200,
      average_minus_target: -171,
      days_at_or_over: 2,
    });
  },
);

Deno.test(
  "get_range_totals lists each logged day with its rounded totals, in date order",
  async () => {
    const { result } = await fetchTotals(boardData([...boardWeek].reverse()), week);

    assertEquals(listOf(result, "days")[1], {
      date: "2026-10-13",
      entry_count: 5,
      kcal: 2250,
      protein_g: 142,
      fat_g: 70,
      carbs_g: 240,
      fibre_g: null,
    });
    assertEquals(
      listOf(result, "days").map((day) => day["date"]),
      boardWeek.map((day) => day.local_date),
    );
  },
);

Deno.test(
  "get_range_totals averages over the days that were logged, not the days in the range",
  async () => {
    const threeDays = [boardWeek[0], boardWeek[2], boardWeek[4]].filter((row) => row !== undefined);
    const { result } = await fetchTotals(boardData(threeDays), week);
    const payload = payloadOf(result);

    assertEquals([field(payload, "days_in_range"), field(payload, "days_logged")], [7, 3]);
    assertEquals(field(field(payload, "daily_average"), "protein_g"), 122);
    assertEquals(field(field(payload, "total"), "protein_g"), 365);
  },
);

Deno.test(
  "get_range_totals reads only the days inside the range, across weeks and a month end",
  async () => {
    const rows = [
      dayTotalsRow("2026-09-27", 4, { kcal: 9000, protein_g: 900, fat_g: 1, carbs_g: 1 }),
      dayTotalsRow("2026-09-30", 3, { kcal: 2000, protein_g: 100, fat_g: 60, carbs_g: 200 }),
      dayTotalsRow("2026-10-02", 2, { kcal: 1800, protein_g: 80, fat_g: 50, carbs_g: 180 }),
      dayTotalsRow("2026-10-07", 9, { kcal: 9000, protein_g: 900, fat_g: 1, carbs_g: 1 }),
    ];
    const { result, calls } = await fetchTotals(boardData(rows), {
      from: "2026-09-28",
      to: "2026-10-04",
    });

    assertEquals(
      listOf(result, "days").map((day) => day["date"]),
      ["2026-09-30", "2026-10-02"],
    );
    assertEquals(field(payloadOf(result), "citation"), "Based on 5 entries, 28 Sep to 4 Oct");
    assertEquals(
      calls
        .filter((call) => call.method === "gte" && call.table === "day_totals")
        .map((call) => call.args[1]),
      ["2026-09-28"],
    );
  },
);

Deno.test("get_range_totals reads one week at a time for a range of several weeks", async () => {
  const { calls } = await fetchTotals(boardData(), { from: "2026-10-07", to: "2026-10-20" });

  assertEquals(
    calls
      .filter((call) => call.method === "gte" && call.table === "day_totals")
      .map((call) => call.args[1]),
    ["2026-10-05", "2026-10-12", "2026-10-19"],
  );
});

Deno.test(
  "get_range_totals answers an empty range with zeros and No entries, never an error",
  async () => {
    const { result } = await fetchTotals({ tables: { profiles: [profileRow()] } }, week);

    assertEquals(payloadOf(result), {
      from: "2026-10-12",
      to: "2026-10-18",
      days_in_range: 7,
      days_logged: 0,
      entry_count: 0,
      days: [],
      total: { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fibre_g: 0 },
      // Nothing was logged, so there is no day to average, and an average of 0 would be untrue.
      daily_average: null,
      against_targets: {
        kcal: { target: 2200, average_minus_target: null, days_at_or_over: 0 },
        protein_g: { target: 140, average_minus_target: null, days_at_or_over: 0 },
        carbs_g: { target: 250, average_minus_target: null, days_at_or_over: 0 },
        fat_g: { target: 70, average_minus_target: null, days_at_or_over: 0 },
      },
      citation: "No entries, 12 to 18 Oct",
    });
  },
);

Deno.test("get_range_totals gives no days at or over for a target that is not set", async () => {
  const { result } = await fetchTotals(
    {
      tables: {
        day_totals: boardWeek,
        profiles: [{ ...profileRow(), target_protein_g: null }],
      },
    },
    week,
  );

  assertEquals(field(field(payloadOf(result), "against_targets"), "protein_g"), {
    target: null,
    average_minus_target: null,
    days_at_or_over: null,
  });
});

Deno.test(
  "get_range_totals leaves a nutrient null that no logged day gave a value for",
  async () => {
    const { result } = await fetchTotals(boardData(), week);
    const payload = payloadOf(result);

    assertEquals(field(field(payload, "daily_average"), "fibre_g"), null);
    assertEquals(field(field(payload, "total"), "fibre_g"), null);
  },
);

Deno.test("get_range_totals reads a range of 92 days and refuses one of 93", async () => {
  const ninetyTwo = await fetchTotals(boardData(), { from: "2026-01-01", to: "2026-04-02" });
  assertEquals(ninetyTwo.result.status, "ok");

  const ninetyThree = await fetchTotals(boardData(), { from: "2026-01-01", to: "2026-04-03" });
  assertEquals(
    ninetyThree.result.status === "error" ? ninetyThree.result.code : null,
    "invalid_input",
  );
  assertEquals(ninetyThree.calls, []);
});

Deno.test(
  "get_range_totals answers invalid_input, not a failure, for a start that is not a date",
  async () => {
    const { result, calls } = await fetchTotals(boardData(), {
      from: "12 October",
      to: "2026-10-13",
    });

    assertEquals(result.status === "error" ? result.code : null, "invalid_input");
    assertEquals(calls, []);
  },
);

Deno.test(
  "get_range_totals refuses an end before the start, a bad date and a key it does not know",
  async () => {
    const badInputs = [
      { from: "2026-10-18", to: "2026-10-12" },
      { from: "2026-10-12", to: "tomorrow" },
      { from: "2026-10-12" },
      { ...week, meal: "lunch" },
    ];

    for (const input of badInputs) {
      const { result, calls } = await fetchTotals(boardData(), input);
      assertEquals(
        result.status === "error" ? result.code : null,
        "invalid_input",
        JSON.stringify(input),
      );
      assertEquals(calls, []);
    }
  },
);

Deno.test(
  "get_range_totals measures the average against the targets of the days that were logged",
  async () => {
    // The programme has a figure for each weekday: 2,000 on weekdays, 2,800 on Saturday, 2,400 on Sunday.
    // Only the weekend is logged, at 2,600 a day, which is exactly the mean of its two targets.
    const weekend = [
      dayTotalsRow("2026-10-17", 3, { kcal: 2600, protein_g: 100, fat_g: 70, carbs_g: 240 }),
      dayTotalsRow("2026-10-18", 3, { kcal: 2600, protein_g: 100, fat_g: 70, carbs_g: 240 }),
    ];
    const { result } = await fetchTotals(
      {
        tables: {
          day_totals: weekend,
          profiles: [profileRow()],
          programs: [{ id: idOf(50), ended_on: null }],
          targets: [
            {
              program_id: idOf(50),
              effective_to: null,
              calories_kcal: 2171,
              protein_g: 140,
              fat_g: 70,
              carbs_g: 250,
              dow_calories_kcal: [2000, 2000, 2000, 2000, 2000, 2800, 2400],
            },
          ],
        },
      },
      week,
    );

    assertEquals(field(field(payloadOf(result), "against_targets"), "kcal"), {
      target: 2600,
      average_minus_target: 0,
      days_at_or_over: 1,
    });
  },
);

Deno.test(
  "get_range_totals warns that today is a partial day and that targets are the current ones",
  () => {
    assertStringIncludes(getRangeTotalsTool.description, "includes today");
    assertStringIncludes(getRangeTotalsTool.description, "partial day");
    assertStringIncludes(getRangeTotalsTool.description, "current targets");
  },
);

Deno.test("the dates of get_range_totals say they are in the user's own time zone", () => {
  assertStringIncludes(
    JSON.stringify(toJsonSchema(getRangeTotalsTool)["properties"]),
    "own time zone",
  );
});
