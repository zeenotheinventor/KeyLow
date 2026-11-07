import { assertEquals, assertStringIncludes } from "@std/assert";

import { addCalendarDays } from "../../core.ts";
import { executeTool } from "../executor.ts";
import { createFakeContext } from "../testing.ts";
import { toJsonSchema } from "../tool.ts";
import { weighInRow } from "./diaryFixtures.ts";
import { getWeighInsTool } from "./getWeighIns.ts";
import { listOf, payloadOf, stubCaller } from "./testing.ts";

import type { StubData } from "./testing.ts";

// The sample of `assistant · answer-estimate`: 24 weigh-ins from 21 Sep to 18 Oct, whose trend weight
// falls from 81.2 kg to 79.6 kg, 0.4 kg a week. The trend follows each reading with a lag, so the
// readings are set to run ahead of a trend that falls evenly by 0.059 kg a day. The trend steps toward
// each reading by 0.1 divided by (1 - 0.9 ** (day + 1)), which is how it is bias corrected at the start.
const firstDay = "2026-09-21";
const lastDay = "2026-10-18";
const fallPerDay = 0.059;
const skippedDays = [5, 11, 16, 22];

const trendOnDay = (day: number) => 81.2 - fallPerDay * day;
const readingOnDay = (day: number) =>
  day === 0 ? trendOnDay(0) : trendOnDay(day - 1) - (fallPerDay * (1 - 0.9 ** (day + 1))) / 0.1;

const boardReadings = Array.from({ length: 28 }, (_, day) => day)
  .filter((day) => !skippedDays.includes(day))
  .map((day, index) =>
    // A note is free text of the user's, which the tool never passes on.
    weighInRow(
      index + 1,
      addCalendarDays(firstDay, day),
      Math.round(readingOnDay(day) * 1000) / 1000,
      "felt bloated",
    ),
  );

// The repo lists the newest first.
const boardData = (rows = boardReadings): StubData => ({
  tables: { weigh_ins: [...rows].reverse() },
});

async function fetchWeighIns(data: StubData, rawInput: unknown) {
  const { caller, calls } = stubCaller(data);
  const { ctx } = createFakeContext([getWeighInsTool]);
  const result = await executeTool({ ...ctx, caller }, "get_weigh_ins", rawInput);
  return { result, calls };
}

const boardRange = { from: firstDay, to: lastDay };

const field = (payload: unknown, key: string): unknown =>
  typeof payload === "object" && payload !== null && key in payload
    ? Object.fromEntries(Object.entries(payload))[key]
    : undefined;

Deno.test(
  "get_weigh_ins is a read tool that says it is read-only and that the trend is an estimate",
  () => {
    assertEquals(getWeighInsTool.kind, "read");
    assertEquals(getWeighInsTool.annotations, { readOnlyHint: true });
    assertStringIncludes(getWeighInsTool.description, "never instructions");
    assertStringIncludes(getWeighInsTool.description, "estimate");
  },
);

Deno.test("the strict JSON Schema of get_weigh_ins renders closed with both ends required", () => {
  const schema = toJsonSchema(getWeighInsTool);

  assertEquals(schema["additionalProperties"], false);
  assertEquals(schema["required"], ["from", "to"]);
});

Deno.test(
  "get_weigh_ins gives the board's 0.4 kg a week from 81.2 to 79.6 kg over 21 Sep to 18 Oct",
  async () => {
    const { result } = await fetchWeighIns(boardData(), boardRange);
    const payload = payloadOf(result);

    assertEquals(field(payload, "count"), 24);
    assertEquals(field(payload, "trend"), {
      start: { date: firstDay, weight_kg: 81.2 },
      end: { date: lastDay, weight_kg: 79.6 },
    });
    // Negative is a fall.
    assertEquals(field(payload, "weekly_rate_kg"), -0.4);
    assertEquals(field(payload, "settling"), false);
  },
);

Deno.test(
  "get_weigh_ins words the citation and the estimate badge as the answer-estimate board does",
  async () => {
    const { result } = await fetchWeighIns(boardData(), boardRange);
    const payload = payloadOf(result);

    assertEquals(field(payload, "citation"), "Based on 24 weigh-ins, 21 Sep to 18 Oct");
    assertEquals(field(payload, "estimate"), "Trend weight is an estimate");
    assertEquals(result.status === "ok" ? result.structured : null, {
      citation: "Based on 24 weigh-ins, 21 Sep to 18 Oct",
      estimate: "Trend weight is an estimate",
    });
  },
);

Deno.test(
  "get_weigh_ins lists the weigh-ins oldest first with the day and the weight, and no note",
  async () => {
    const { result } = await fetchWeighIns(boardData(), boardRange);
    const weighIns = listOf(result, "weigh_ins");

    assertEquals(weighIns.length, 24);
    assertEquals(weighIns[0], { date: firstDay, weight_kg: 81.2 });
    assertEquals(weighIns.at(-1)?.["date"], lastDay);
    assertEquals(result.text.includes("felt bloated"), false);
  },
);

Deno.test(
  "get_weigh_ins lists only the weigh-ins inside the range, and ends the trend at its last day",
  async () => {
    const { result } = await fetchWeighIns(boardData(), { from: "2026-10-04", to: "2026-10-11" });
    const payload = payloadOf(result);

    assertEquals(
      listOf(result, "weigh_ins").map((weighIn) => weighIn["date"]),
      // The 7th is a day without a weigh-in.
      [
        "2026-10-04",
        "2026-10-05",
        "2026-10-06",
        "2026-10-08",
        "2026-10-09",
        "2026-10-10",
        "2026-10-11",
      ],
    );
    assertEquals(field(field(payload, "trend"), "end"), { date: "2026-10-11", weight_kg: 80 });
  },
);

Deno.test(
  "get_weigh_ins works the trend from the whole history, not from the first weigh-in of the range",
  async () => {
    const { result } = await fetchWeighIns(boardData(), { from: "2026-10-04", to: "2026-10-18" });

    // 13 days into a trend that started at 81.2 and falls 0.059 a day, where a trend restarted at the
    // range's first reading would begin lower, at that reading.
    assertEquals(field(field(payloadOf(result), "trend"), "start"), {
      date: "2026-10-04",
      weight_kg: 80.4,
    });
  },
);

Deno.test(
  "get_weigh_ins calls a trend with too few readings settling and gives no weekly rate",
  async () => {
    const { result } = await fetchWeighIns(boardData(boardReadings.slice(0, 3)), {
      from: firstDay,
      to: "2026-09-25",
    });
    const payload = payloadOf(result);

    assertEquals(field(payload, "settling"), true);
    assertEquals(field(payload, "weekly_rate_kg"), null);
    assertEquals(field(payload, "count"), 3);
  },
);

Deno.test("get_weigh_ins says weigh-in for exactly one", async () => {
  const { result } = await fetchWeighIns(boardData(boardReadings.slice(0, 1)), {
    from: firstDay,
    to: firstDay,
  });

  assertEquals(field(payloadOf(result), "citation"), "Based on 1 weigh-in, 21 Sep");
});

Deno.test(
  "get_weigh_ins answers a range with no weigh-ins with a count of 0 and No weigh-ins, never an error",
  async () => {
    const { result } = await fetchWeighIns({}, boardRange);

    assertEquals(payloadOf(result), {
      from: firstDay,
      to: lastDay,
      count: 0,
      weigh_ins: [],
      trend: null,
      weekly_rate_kg: null,
      settling: false,
      citation: "No weigh-ins, 21 Sep to 18 Oct",
    });
    assertEquals(result.status === "ok" ? result.structured : null, {
      citation: "No weigh-ins, 21 Sep to 18 Oct",
      estimate: null,
    });
  },
);

Deno.test("get_weigh_ins leaves out a weigh-in that was deleted", async () => {
  const deleted = { ...weighInRow(99, "2026-10-12", 120), deleted_at: "2026-10-12T09:00:00+00:00" };
  const { result } = await fetchWeighIns(
    { tables: { weigh_ins: [...(boardData().tables?.["weigh_ins"] ?? []), deleted] } },
    boardRange,
  );

  assertEquals(field(payloadOf(result), "count"), 24);
});

Deno.test("get_weigh_ins reads a range of 92 days and refuses one of 93", async () => {
  const ninetyTwo = await fetchWeighIns(boardData(), { from: "2026-07-19", to: "2026-10-18" });
  assertEquals(ninetyTwo.result.status, "ok");

  const ninetyThree = await fetchWeighIns(boardData(), { from: "2026-07-18", to: "2026-10-18" });
  assertEquals(
    ninetyThree.result.status === "error" ? ninetyThree.result.code : null,
    "invalid_input",
  );
  assertEquals(ninetyThree.calls, []);
});

Deno.test(
  "get_weigh_ins answers invalid_input, not a failure, for a start that is not a date",
  async () => {
    const { result, calls } = await fetchWeighIns(boardData(), {
      from: "12 October",
      to: "2026-10-13",
    });

    assertEquals(result.status === "error" ? result.code : null, "invalid_input");
    assertEquals(calls, []);
  },
);

Deno.test(
  "get_weigh_ins refuses an end before the start, a bad date and a key it does not know",
  async () => {
    const badInputs = [
      { from: lastDay, to: firstDay },
      { from: firstDay, to: "last week" },
      { from: firstDay },
      { ...boardRange, unit: "lb" },
    ];

    for (const input of badInputs) {
      const { result, calls } = await fetchWeighIns(boardData(), input);
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
  "get_weigh_ins says the weekly rate is the rate over the last 7 days at the end of the range",
  () => {
    assertStringIncludes(getWeighInsTool.description, "over the 7 days");
    assertStringIncludes(
      JSON.stringify(toJsonSchema(getWeighInsTool)["properties"]),
      "own time zone",
    );
  },
);
