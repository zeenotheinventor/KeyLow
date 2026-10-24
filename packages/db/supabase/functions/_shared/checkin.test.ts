import { assert, assertAlmostEquals, assertEquals, assertRejects, assertThrows } from "@std/assert";

import {
  datesToRun,
  maximumCheckinsPerCall,
  readRange,
  recomputeWeighInDays,
  callRecordCheckin,
  callRecordTargets,
  planRecompute,
  readFailure,
  readPriorBelief,
  readRequestBody,
  readRunCheckinRequest,
  recomputeLogLine,
  recordCheckinFailure,
  refusedLogLine,
  requireCompleteRead,
  requireUniqueDates,
  runCheckinLoop,
  runLogLine,
  toCheckinInput,
  toCheckinProgram,
  toRecordCheckinArguments,
  toRecordOutcome,
  toRecordTargetsArguments,
  toWeighIns,
  trendWeightOn,
} from "./checkin.ts";
import { addCalendarDays, checkinStep, toDayInputs } from "./core.ts";
import { handle } from "./http.ts";
import { toSafeError } from "./report.ts";

import type {
  CheckinLoopDependencies,
  CheckinReads,
  RecomputeReads,
  RecordOutcome,
  StoredCheckinState,
} from "./checkin.ts";
import type { CheckinResult, ExpenditureBelief } from "./core.ts";

// The golden run of ADR 0002, Amendment 2: day 0 to day 27 hold a weigh-in of 80 - 0.05 * day kg and
// 2200 kcal, all complete. Day 28 is today, so the check-ins are due on days 14, 21 and 28.
const day0 = "2026-09-26";
const day = (offset: number) => addCalendarDays(day0, offset);

const goldenPrior: ExpenditureBelief = { muKcal: 2500, varKcal2: 140625 };

const goldenProgram = toCheckinProgram({
  goal: "lose",
  rate_pct_per_week: 0.5,
  protein_g_per_kg: 1.6,
  fat_fraction_of_remaining: 0.4,
  dow_offsets_kcal: [0, 0, 0, 0, 0, 0, 0],
});

function goldenReads(): CheckinReads {
  const offsets = Array.from({ length: 28 }, (_, offset) => offset);
  return {
    program: goldenProgram,
    // Male, 180 cm, 80 kg and 35 years old on every check-in: Mifflin-St Jeor gives 1755.
    stats: { sex: "male", birthDate: "1991-04-01", heightCm: 180, activity: "light" },
    onboardingWeightKg: 80,
    weighIns: toWeighIns(
      offsets.map((offset) => ({ local_date: day(offset), weight_kg: 80 - 0.05 * offset })),
    ),
    days: toDayInputs(
      offsets.map((offset) => ({ local_date: day(offset), kcal: 2200 })),
      offsets.map((offset) => ({ local_date: day(offset), is_complete: true })),
    ),
  };
}

function goldenStep(reads: CheckinReads = goldenReads()) {
  return (asOfDate: string, prior: ExpenditureBelief): CheckinResult =>
    checkinStep(toCheckinInput(reads, asOfDate, prior));
}

type Recorded = { asOfDate: string; muKcal: number; nextCheckinDate: string };

// Fakes for the three things the loop reaches for. `outcomes` is what the writer answers, in order, and
// `stored` is what a re-read after a duplicate finds.
function fakeLoop(options: {
  outcomes?: RecordOutcome[];
  stored?: StoredCheckinState[];
  step?: CheckinLoopDependencies["step"];
}) {
  const recorded: Recorded[] = [];
  const priorsStepped: ExpenditureBelief[] = [];
  const stepsAsOf: string[] = [];
  const outcomes = [...(options.outcomes ?? [])];
  const stored = [...(options.stored ?? [])];
  const realStep = options.step ?? goldenStep();
  const dependencies: CheckinLoopDependencies = {
    step: (asOfDate, prior) => {
      stepsAsOf.push(asOfDate);
      priorsStepped.push(prior);
      return realStep(asOfDate, prior);
    },
    record: (result, nextCheckinDate) => {
      recorded.push({
        asOfDate: result.snapshot.as_of_date,
        muKcal: result.snapshot.mu_kcal,
        nextCheckinDate,
      });
      return Promise.resolve(outcomes.shift() ?? "recorded");
    },
    reload: () => {
      const next = stored.shift();
      if (next === undefined) {
        throw new Error("The test did not expect a re-read");
      }
      return Promise.resolve(next);
    },
  };
  return { dependencies, recorded, priorsStepped, stepsAsOf };
}

const startState: StoredCheckinState = { prior: goldenPrior, nextCheckinDate: day(14) };
const threeDueDates = [day(14), day(21), day(28)];

Deno.test("a call runs at most 8 check-ins", () => {
  assertEquals(maximumCheckinsPerCall, 8);
});

Deno.test("datesToRun lists every due date, oldest first", () => {
  assertEquals(datesToRun("2026-10-10", "2026-10-24"), ["2026-10-10", "2026-10-17", "2026-10-24"]);
});

Deno.test("datesToRun is empty when the next check-in is after today", () => {
  assertEquals(datesToRun("2026-10-25", "2026-10-24"), []);
});

Deno.test("datesToRun is empty when the program has no next check-in date", () => {
  assertEquals(datesToRun(null, "2026-10-24"), []);
});

Deno.test("datesToRun keeps the oldest 8 when more are due", () => {
  assertEquals(datesToRun("2026-08-01", "2026-10-24"), [
    "2026-08-01",
    "2026-08-08",
    "2026-08-15",
    "2026-08-22",
    "2026-08-29",
    "2026-09-05",
    "2026-09-12",
    "2026-09-19",
  ]);
});

Deno.test("readRange for one due date today runs from 28 days before it to yesterday", () => {
  assertEquals(readRange(["2026-10-24"]), {
    from: "2026-09-26",
    weighInsFrom: "2026-06-28",
    to: "2026-10-23",
  });
});

Deno.test(
  "readRange for three due dates starts 28 days before the first and ends before the last",
  () => {
    assertEquals(readRange(["2026-10-10", "2026-10-17", "2026-10-24"]), {
      from: "2026-09-12",
      weighInsFrom: "2026-06-14",
      to: "2026-10-23",
    });
  },
);

Deno.test(
  "readRange ends the day before the last date to run, which can be before yesterday",
  () => {
    assertEquals(readRange(["2026-10-03", "2026-10-10"]), {
      from: "2026-09-05",
      weighInsFrom: "2026-06-07",
      to: "2026-10-09",
    });
  },
);

Deno.test(
  "readRange starts the weigh-ins 90 days before the diary days, to warm the trend up",
  () => {
    const range = readRange(["2026-10-24"]);

    assertEquals(range?.from, "2026-09-26");
    assertEquals(range?.weighInsFrom, "2026-06-28");
  },
);

Deno.test("readRange is null when there is nothing to run", () => {
  assertEquals(readRange([]), null);
});

Deno.test("toWeighIns names the fields the trend reads", () => {
  assertEquals(toWeighIns([{ local_date: "2026-10-01", weight_kg: 80.25 }]), [
    { localDate: "2026-10-01", weightKg: 80.25 },
  ]);
});

Deno.test("toCheckinProgram turns the program row into the check-in's program", () => {
  assertEquals(
    toCheckinProgram({
      goal: "gain",
      rate_pct_per_week: 0.25,
      protein_g_per_kg: 2,
      fat_fraction_of_remaining: 0.3,
      dow_offsets_kcal: [300, -300, 0, 0, 0, 0, 0],
    }),
    {
      goal: "gain",
      ratePctPerWeek: 0.25,
      proteinGPerKg: 2,
      fatFraction: 0.3,
      dowOffsetsKcal: [300, -300, 0, 0, 0, 0, 0],
    },
  );
});

Deno.test("toCheckinProgram refuses offsets that are not seven whole numbers", () => {
  assertThrows(
    () =>
      toCheckinProgram({
        goal: "lose",
        rate_pct_per_week: 0.5,
        protein_g_per_kg: 1.6,
        fat_fraction_of_remaining: 0.4,
        dow_offsets_kcal: [0, 0, 0, 0, 0, 0],
      }),
    RangeError,
  );
});

Deno.test("toCheckinInput carries the rows, the prior and the onboarding weight", () => {
  const reads = goldenReads();

  const input = toCheckinInput(reads, day(14), goldenPrior);

  assertEquals(input.asOfDate, day(14));
  assertEquals(input.prior, goldenPrior);
  assertEquals(input.weighIns, reads.weighIns);
  assertEquals(input.days, reads.days);
  assertEquals(input.program, goldenProgram);
  assertEquals(input.onboardingWeightKg, 80);
});

Deno.test("toCheckinInput works the floor's BMR out for the age on the check-in date", () => {
  const reads: CheckinReads = {
    ...goldenReads(),
    stats: { sex: "male", birthDate: "1991-11-01", heightCm: 180, activity: "light" },
  };

  // 80 kg, 180 cm, male: 10 * 80 + 6.25 * 180 - 5 * age + 5, which is 1760 at 34 and 1755 at 35.
  assertEquals(toCheckinInput(reads, "2026-10-24", goldenPrior).bmrKcal, 1760);
  assertEquals(toCheckinInput(reads, "2026-11-07", goldenPrior).bmrKcal, 1755);
});

Deno.test("the golden run through the loop gives the golden snapshots and targets", async () => {
  const fake = fakeLoop({});

  const result = await runCheckinLoop(threeDueDates, startState, fake.dependencies);

  assertEquals(
    fake.recorded.map(({ asOfDate }) => asOfDate),
    threeDueDates,
  );
  assertAlmostEquals(fake.recorded[0]?.muKcal ?? 0, 2559.56, 0.5);
  assertAlmostEquals(fake.recorded[1]?.muKcal ?? 0, 2574.22, 0.5);
  assertAlmostEquals(fake.recorded[2]?.muKcal ?? 0, 2579.54, 0.5);
  assertEquals(result, { ran: 3, nextCheckinDate: day(35) });
});

Deno.test("each check-in of the loop starts from the belief the one before it left", async () => {
  const fake = fakeLoop({});

  await runCheckinLoop(threeDueDates, startState, fake.dependencies);

  assertEquals(fake.priorsStepped[0], goldenPrior);
  assertAlmostEquals(fake.priorsStepped[1]?.muKcal ?? 0, 2559.56, 0.5);
  assertAlmostEquals(fake.priorsStepped[1]?.varKcal2 ?? 0, 43771.7, 0.5);
  assertAlmostEquals(fake.priorsStepped[2]?.muKcal ?? 0, 2574.22, 0.5);
  assertAlmostEquals(fake.priorsStepped[2]?.varKcal2 ?? 0, 20939.4, 0.5);
});

Deno.test("the loop asks the writer for the next date a week after each check-in", async () => {
  const fake = fakeLoop({});

  await runCheckinLoop(threeDueDates, startState, fake.dependencies);

  assertEquals(
    fake.recorded.map(({ nextCheckinDate }) => nextCheckinDate),
    [day(21), day(28), day(35)],
  );
});

Deno.test("the day 28 targets of the golden run are 2140 kcal, P 126, F 73, C 245", () => {
  const step = goldenStep();
  const first = step(day(14), goldenPrior);
  const second = step(day(21), {
    muKcal: first.snapshot.mu_kcal,
    varKcal2: first.snapshot.var_kcal2,
  });
  const third = step(day(28), {
    muKcal: second.snapshot.mu_kcal,
    varKcal2: second.snapshot.var_kcal2,
  });

  assertEquals(third.targets.calories_kcal, 2140);
  assertEquals(third.targets.protein_g, 126);
  assertEquals(third.targets.fat_g, 73);
  assertEquals(third.targets.carbs_g, 245);
});

Deno.test("the loop runs nothing when no date is due", async () => {
  const fake = fakeLoop({});

  const result = await runCheckinLoop([], startState, fake.dependencies);

  assertEquals(result, { ran: 0, nextCheckinDate: day(14) });
  assertEquals(fake.recorded, []);
});

Deno.test("after a duplicate the loop re-reads and carries on from the stored belief", async () => {
  const storedBelief: ExpenditureBelief = { muKcal: 2559.56, varKcal2: 43771.7 };
  const fake = fakeLoop({
    outcomes: ["duplicate"],
    stored: [{ prior: storedBelief, nextCheckinDate: day(21) }],
  });

  const result = await runCheckinLoop(threeDueDates, startState, fake.dependencies);

  assertEquals(fake.stepsAsOf, [day(14), day(21), day(28)]);
  assertEquals(fake.priorsStepped[1], storedBelief);
  assertEquals(result, { ran: 2, nextCheckinDate: day(35) });
});

Deno.test("a duplicate is not counted as a check-in this call ran", async () => {
  const fake = fakeLoop({
    outcomes: ["duplicate"],
    stored: [{ prior: goldenPrior, nextCheckinDate: day(35) }],
  });

  const result = await runCheckinLoop(threeDueDates, startState, fake.dependencies);

  assertEquals(result.ran, 0);
});

Deno.test("the loop stops once the stored date is past every date it planned", async () => {
  const fake = fakeLoop({
    outcomes: ["duplicate"],
    stored: [{ prior: goldenPrior, nextCheckinDate: day(35) }],
  });

  const result = await runCheckinLoop(threeDueDates, startState, fake.dependencies);

  assertEquals(fake.recorded.length, 1);
  assertEquals(result, { ran: 0, nextCheckinDate: day(35) });
});

Deno.test("the loop stops when a re-read finds no next check-in date", async () => {
  const fake = fakeLoop({
    outcomes: ["duplicate"],
    stored: [{ prior: goldenPrior, nextCheckinDate: null }],
  });

  const result = await runCheckinLoop(threeDueDates, startState, fake.dependencies);

  assertEquals(fake.recorded.length, 1);
  assertEquals(result, { ran: 0, nextCheckinDate: null });
});

Deno.test("the loop stops when a re-read finds a date before the one it planned", async () => {
  const fake = fakeLoop({
    outcomes: ["duplicate"],
    stored: [{ prior: goldenPrior, nextCheckinDate: day(7) }],
  });

  const result = await runCheckinLoop(threeDueDates, startState, fake.dependencies);

  assertEquals(fake.recorded.length, 1);
  assertEquals(result, { ran: 0, nextCheckinDate: day(7) });
});

Deno.test(
  "when the program ended the loop stops without an error and answers no next date",
  async () => {
    const fake = fakeLoop({ outcomes: ["recorded", "program_ended"] });

    const result = await runCheckinLoop(threeDueDates, startState, fake.dependencies);

    assertEquals(fake.recorded.length, 2);
    assertEquals(result, { ran: 1, nextCheckinDate: null });
  },
);

Deno.test(
  "a program that ended before the first check-in answers ran 0 and no next date",
  async () => {
    const fake = fakeLoop({ outcomes: ["program_ended"] });

    const result = await runCheckinLoop(threeDueDates, startState, fake.dependencies);

    assertEquals(result, { ran: 0, nextCheckinDate: null });
  },
);

Deno.test("the loop does not hide a failed write", async () => {
  const fake = fakeLoop({});
  const failing: CheckinLoopDependencies = {
    ...fake.dependencies,
    record: () => Promise.reject(recordCheckinFailure("23514")),
  };

  await assertRejects(() => runCheckinLoop(threeDueDates, startState, failing), Error);
});

Deno.test("toRecordCheckinArguments names every column the writer reads and no more", () => {
  const result = goldenStep()(day(14), goldenPrior);

  const args = toRecordCheckinArguments("user-id", "program-id", result, day(21));

  assertEquals(args.p_user_id, "user-id");
  assertEquals(args.p_next_checkin_date, day(21));
  assertEquals(Object.keys(args.p_snapshot).sort(), [
    "as_of_date",
    "engine_version",
    "measurement",
    "mu_kcal",
    "params",
    "program_id",
    "trend_weight_kg",
    "var_kcal2",
  ]);
  assertEquals(Object.keys(args.p_targets).sort(), [
    "basis",
    "calories_kcal",
    "carbs_g",
    "dow_calories_kcal",
    "engine_version",
    "fat_g",
    "params",
    "protein_g",
  ]);
});

Deno.test("toRecordCheckinArguments sends the snapshot and the targets the step produced", () => {
  const result = goldenStep()(day(14), goldenPrior);

  const args = toRecordCheckinArguments("user-id", "program-id", result, day(21));

  assertEquals(args.p_snapshot, {
    program_id: "program-id",
    as_of_date: day(14),
    mu_kcal: result.snapshot.mu_kcal,
    var_kcal2: result.snapshot.var_kcal2,
    measurement: JSON.parse(JSON.stringify(result.snapshot.measurement)),
    trend_weight_kg: result.snapshot.trend_weight_kg,
    engine_version: "keylow-engine-v1",
    params: JSON.parse(JSON.stringify(result.snapshot.params)),
  });
  assertEquals(
    JSON.parse(JSON.stringify(args.p_targets)),
    JSON.parse(
      JSON.stringify({
        calories_kcal: result.targets.calories_kcal,
        protein_g: result.targets.protein_g,
        fat_g: result.targets.fat_g,
        carbs_g: result.targets.carbs_g,
        dow_calories_kcal: result.targets.dow_calories_kcal,
        basis: result.targets.basis,
        engine_version: result.targets.engine_version,
        params: result.targets.params,
      }),
    ),
  );
});

Deno.test("readRunCheckinRequest reads an empty object and the due mode as due", () => {
  assertEquals(readRunCheckinRequest({}), { ok: true, mode: "due" });
  assertEquals(readRunCheckinRequest({ mode: "due" }), { ok: true, mode: "due" });
});

Deno.test("readRunCheckinRequest reads the recompute mode as recompute", () => {
  assertEquals(readRunCheckinRequest({ mode: "recompute" }), { ok: true, mode: "recompute" });
});

Deno.test("readRunCheckinRequest reads the backstop mode as backstop", () => {
  assertEquals(readRunCheckinRequest({ mode: "backstop" }), { ok: true, mode: "backstop" });
});

Deno.test("readRunCheckinRequest answers bad_mode for any other mode", () => {
  for (const mode of ["weekly", "", 7, null]) {
    assertEquals(readRunCheckinRequest({ mode }), { ok: false, code: "bad_mode" });
  }
});

Deno.test("readRunCheckinRequest answers invalid_request for a body that is not an object", () => {
  for (const body of [null, "due", 3, []]) {
    assertEquals(readRunCheckinRequest(body), { ok: false, code: "invalid_request" });
  }
});

// What PostgREST sends for a refused write: the message, the details and the hint quote the row.
const refusedWrite = {
  code: "23514",
  message: 'new row for relation "targets" violates check constraint "targets_calories_range"',
  details: "Failing row contains (2147, 4821, 31337, 1999.5).",
  hint: "The row held 8675309 kcal.",
};
const healthValues = ["2147", "4821", "31337", "1999.5", "8675309"];

Deno.test("recordCheckinFailure carries the database code and nothing else", () => {
  const failure = recordCheckinFailure(refusedWrite.code);

  assertEquals(failure.message.includes(refusedWrite.code), true);
  for (const value of healthValues) {
    assertEquals(failure.message.includes(value), false);
  }
});

Deno.test("recordCheckinFailure reads a code that is not a short code as unknown", () => {
  const failure = recordCheckinFailure(refusedWrite.details);

  assertEquals(failure.message.includes("unknown"), true);
  for (const value of healthValues) {
    assertEquals(failure.message.includes(value), false);
  }
  assertEquals(
    recordCheckinFailure("A".repeat(17)).message,
    "record_checkin was refused with code unknown",
  );
  assertEquals(
    recordCheckinFailure("23 14").message,
    "record_checkin was refused with code unknown",
  );
});

Deno.test(
  "a refused write reaches the response and the report with no health value in them",
  async () => {
    const reported: unknown[] = [];
    const handler = handle(
      "run-checkin",
      () => {
        toRecordOutcome({ data: null, error: refusedWrite });
        return new Response("not reached");
      },
      (_functionName, _code, caught) => reported.push(caught),
    );

    const response = await handler(new Request("http://localhost/run-checkin", { method: "POST" }));
    const body = await response.text();

    assertEquals(response.status, 500);
    assertEquals(reported.length, 1);
    const sentToSentry = JSON.stringify(toSafeError(reported[0]).stack);
    for (const value of healthValues) {
      assertEquals(body.includes(value), false);
      assertEquals(sentToSentry.includes(value), false);
      assertEquals(String(reported[0]).includes(value), false);
    }
  },
);

Deno.test("readFailure names the table and the database code and nothing else", () => {
  const failure = readFailure("weigh_ins", "42501");

  assertEquals(failure.message, "Reading weigh_ins failed with code 42501");
  assertEquals(readFailure("weigh_ins", refusedWrite.details).message.includes("2147"), false);
});

Deno.test("toRecordOutcome reads the three answers of the writer", () => {
  for (const outcome of ["recorded", "duplicate", "program_ended"]) {
    assertEquals(toRecordOutcome({ data: outcome, error: null }), outcome);
  }
});

Deno.test("toRecordOutcome refuses an answer it does not know", () => {
  assertThrows(() => toRecordOutcome({ data: "teapot", error: null }));
  assertThrows(() => toRecordOutcome({ data: null, error: null }));
});

Deno.test("toRecordOutcome throws the code of a refused write and none of the row", () => {
  const failure = assertThrows(() => toRecordOutcome({ data: null, error: refusedWrite }), Error);

  assertEquals(failure.message, "record_checkin was refused with code 23514");
});

Deno.test("readRequestBody reads an empty body as an empty object, and JSON as itself", () => {
  assertEquals(readRequestBody(""), { ok: true, body: {} });
  assertEquals(readRequestBody('{"mode":"due"}'), { ok: true, body: { mode: "due" } });
  assertEquals(readRequestBody("not json"), { ok: false });
});

Deno.test(
  "a refused rpc answer reaches neither the response nor the log with a number of the row",
  async () => {
    const lines: string[] = [];
    const originalError = console.error;
    console.error = (...parts: unknown[]) => lines.push(parts.map(String).join(" "));
    const refusedRpc = () => Promise.resolve({ data: null, error: refusedWrite });
    const result = goldenStep()(day(14), goldenPrior);
    let response: Response;
    try {
      response = await handle("run-checkin", async () => {
        await callRecordCheckin(refusedRpc, "user-id", "program-id", result, day(21));
        return new Response("not reached");
      })(new Request("http://localhost/run-checkin", { method: "POST" }));
    } finally {
      console.error = originalError;
    }
    const body = await response.text();

    assertEquals(response.status, 500);
    assertEquals(lines.length > 0, true);
    for (const value of healthValues) {
      assertEquals(body.includes(value), false);
      assertEquals(lines.join("\n").includes(value), false);
    }
  },
);

Deno.test(
  "callRecordCheckin sends the arguments of the writer and answers its outcome",
  async () => {
    const sent: unknown[] = [];
    const rpc = (args: unknown) => {
      sent.push(args);
      return Promise.resolve({ data: "duplicate", error: null });
    };
    const result = goldenStep()(day(14), goldenPrior);

    const outcome = await callRecordCheckin(rpc, "user-id", "program-id", result, day(21));

    assertEquals(outcome, "duplicate");
    assertEquals(sent, [toRecordCheckinArguments("user-id", "program-id", result, day(21))]);
  },
);

Deno.test("the log line of a run holds the user id, the count and the duration only", () => {
  assertEquals(
    runLogLine({ userId: "0c5f8d4e", ran: 3, durationMilliseconds: 412 }),
    "run-checkin due user=0c5f8d4e ran=3 duration_ms=412",
  );
});

Deno.test("the log line of a refusal holds the user id and the code only", () => {
  assertEquals(
    refusedLogLine("0c5f8d4e", "missing_stats"),
    "run-checkin refused user=0c5f8d4e code=missing_stats",
  );
});

Deno.test("requireCompleteRead returns the rows of a read under the row limit", () => {
  const rows = Array.from({ length: 999 }, (_, index) => ({ index }));

  assertEquals(requireCompleteRead(rows, "weigh_ins"), rows);
});

Deno.test("requireCompleteRead refuses a read that may have been cut at the row limit", () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({ index }));

  const error = assertThrows(() => requireCompleteRead(rows, "weigh_ins"), Error);

  assert(error.message.includes("weigh_ins"));
});

Deno.test("requireUniqueDates returns rows with one row for each date", () => {
  const rows = [{ local_date: "2026-10-01" }, { local_date: "2026-10-02" }];

  assertEquals(requireUniqueDates(rows, "day_logs"), rows);
});

Deno.test(
  "requireUniqueDates refuses two rows for one date, naming the table and a code only",
  () => {
    const rows = [
      { local_date: "2026-10-01" },
      { local_date: "2026-10-02" },
      { local_date: "2026-10-01" },
    ];

    const error = assertThrows(() => requireUniqueDates(rows, "day_logs"), Error);

    assertEquals(error.message, "Reading day_logs failed with code duplicate_date");
  },
);

// Recompute (ADR 0002, Amendment 2, "The start snapshot and the schedule" and "Recompute"). Today is day 28
// of the golden run, 2026-10-24, a Saturday. The profile is the golden one but at the activity "light",
// so the starting estimate is Mifflin-St Jeor 1755 times 1.375, which is 2413.125, with a variance of
// 131021.376. The golden start snapshot of 2500 is a figure the golden fixture chose for itself.
const today = day(28);

const goldenStats = {
  sex: "male",
  birthDate: "1991-04-01",
  heightCm: 180,
  activity: "light",
} as const;

function recomputeReads(overrides: Partial<RecomputeReads> = {}): RecomputeReads {
  return {
    program: goldenProgram,
    nextCheckinDate: null,
    stats: goldenStats,
    onboardingWeightKg: 80,
    newest: null,
    weighIns: [],
    today,
    ...overrides,
  };
}

const goldenWeighIns = goldenReads().weighIns;

Deno.test(
  "planRecompute makes a new start snapshot as of today when the user has no snapshot",
  () => {
    const plan = planRecompute(recomputeReads());

    assertEquals(plan.branch, "new");
    assertEquals(plan.startSnapshot?.kind, "start");
    assertEquals(plan.startSnapshot?.as_of_date, today);
    assertAlmostEquals(plan.startSnapshot?.mu_kcal ?? 0, 2413.125, 1e-9);
    assertAlmostEquals(plan.startSnapshot?.var_kcal2 ?? 0, 131021.376, 1e-3);
    assertEquals(plan.startSnapshot?.measurement, null);
    assertEquals(plan.expenditureSnapshotId, null);
  },
);

Deno.test(
  "planRecompute starts the targets from the new start snapshot, with the source start",
  () => {
    const plan = planRecompute(recomputeReads());

    assertEquals(plan.targets.basis.source, "start");
    assertAlmostEquals(plan.targets.basis.tdeeKcal, 2413.125, 1e-9);
    assertEquals(plan.targets.effective_from, today);
    assertEquals(plan.targets.calories_kcal, 1970);
    assertEquals(plan.targets.protein_g, 128);
  },
);

Deno.test(
  "planRecompute leaves the trend weight of a start snapshot null without a weigh-in",
  () => {
    const plan = planRecompute(recomputeReads());

    assertEquals(plan.startSnapshot?.trend_weight_kg, null);
    assertEquals(plan.targets.basis.trendWeightKg, 80);
  },
);

Deno.test(
  "planRecompute puts the trend weight of the day before in a start snapshot and in the targets",
  () => {
    const plan = planRecompute(recomputeReads({ weighIns: goldenWeighIns }));

    assertAlmostEquals(plan.startSnapshot?.trend_weight_kg ?? 0, 79.022685, 1e-6);
    assertAlmostEquals(plan.targets.basis.trendWeightKg, 79.022685, 1e-6);
    assertEquals(plan.targets.calories_kcal, 1980);
    assertEquals(plan.targets.protein_g, 126);
  },
);

Deno.test(
  "planRecompute ignores a weigh-in dated today, because the trend is the day before's",
  () => {
    const plan = planRecompute(recomputeReads({ weighIns: [{ localDate: today, weightKg: 90 }] }));

    assertEquals(plan.startSnapshot?.trend_weight_kg, null);
    assertEquals(plan.targets.basis.trendWeightKg, 80);
  },
);

Deno.test("planRecompute rewrites a start snapshot that is the newest, on its own date", () => {
  const plan = planRecompute(
    recomputeReads({
      newest: { id: "snapshot-1", kind: "start", as_of_date: day(18), mu_kcal: 2000 },
    }),
  );

  assertEquals(plan.branch, "rewrite");
  assertEquals(plan.startSnapshot?.as_of_date, day(18));
  assertAlmostEquals(plan.startSnapshot?.mu_kcal ?? 0, 2413.125, 1e-9);
  assertEquals(plan.expenditureSnapshotId, null);
  assertEquals(plan.targets.basis.source, "start");
  assertAlmostEquals(plan.targets.basis.tdeeKcal, 2413.125, 1e-9);
  assertEquals(plan.targets.effective_from, today);
});

Deno.test(
  "planRecompute takes a rewritten snapshot's trend weight from the day before its own date",
  () => {
    const plan = planRecompute(
      recomputeReads({
        weighIns: goldenWeighIns,
        newest: { id: "snapshot-1", kind: "start", as_of_date: day(14), mu_kcal: 2000 },
      }),
    );

    assertAlmostEquals(plan.startSnapshot?.trend_weight_kg ?? 0, 79.592361, 1e-6);
    assertAlmostEquals(plan.targets.basis.trendWeightKg, 79.022685, 1e-6);
  },
);

Deno.test("planRecompute still rewrites a start snapshot of exactly 28 days ago", () => {
  const plan = planRecompute(
    recomputeReads({
      newest: { id: "snapshot-1", kind: "start", as_of_date: day(0), mu_kcal: 2000 },
    }),
  );

  assertEquals(plan.branch, "rewrite");
  assertEquals(plan.startSnapshot?.as_of_date, day(0));
});

Deno.test(
  "planRecompute makes a new start snapshot as of today when the newest is 29 days old",
  () => {
    const plan = planRecompute(
      recomputeReads({
        newest: { id: "snapshot-1", kind: "start", as_of_date: day(-1), mu_kcal: 2000 },
      }),
    );

    assertEquals(plan.branch, "new");
    assertEquals(plan.startSnapshot?.as_of_date, today);
  },
);

Deno.test(
  "planRecompute keeps the learned expenditure after a check-in and writes no snapshot",
  () => {
    const plan = planRecompute(
      recomputeReads({
        newest: { id: "snapshot-2", kind: "checkin", as_of_date: day(18), mu_kcal: 2579.54 },
      }),
    );

    assertEquals(plan.branch, "none");
    assertEquals(plan.startSnapshot, null);
    assertEquals(plan.expenditureSnapshotId, "snapshot-2");
    assertEquals(plan.targets.basis.source, "recompute");
    assertAlmostEquals(plan.targets.basis.tdeeKcal, 2579.54, 1e-9);
    assertEquals(plan.targets.calories_kcal, 2140);
  },
);

Deno.test(
  "planRecompute makes a new start snapshot when the newest check-in is over 28 days old",
  () => {
    const plan = planRecompute(
      recomputeReads({
        newest: { id: "snapshot-2", kind: "checkin", as_of_date: day(-1), mu_kcal: 2579.54 },
      }),
    );

    assertEquals(plan.branch, "new");
    assertEquals(plan.startSnapshot?.as_of_date, today);
    assertEquals(plan.targets.basis.source, "start");
  },
);

Deno.test(
  "planRecompute sets the schedule on every branch when the program has no next date",
  () => {
    const newestOf = (kind: "start" | "checkin", asOfDate: string) => ({
      id: "snapshot-1",
      kind,
      as_of_date: asOfDate,
      mu_kcal: 2500,
    });
    const cases = [
      { branch: "new", newest: null },
      { branch: "rewrite", newest: newestOf("start", day(18)) },
      { branch: "none", newest: newestOf("checkin", day(18)) },
    ] as const;

    for (const { branch, newest } of cases) {
      const plan = planRecompute(recomputeReads({ newest, nextCheckinDate: null }));

      assertEquals(plan.branch, branch);
      assertEquals(plan.schedule, { nextCheckinDate: "2026-11-07", checkinWeekday: 6 });
    }
  },
);

Deno.test(
  "planRecompute leaves the schedule alone on every branch when the program has a next date",
  () => {
    const newestOf = (kind: "start" | "checkin", asOfDate: string) => ({
      id: "snapshot-1",
      kind,
      as_of_date: asOfDate,
      mu_kcal: 2500,
    });
    const cases = [null, newestOf("start", day(18)), newestOf("checkin", day(18))];

    for (const newest of cases) {
      const plan = planRecompute(recomputeReads({ newest, nextCheckinDate: day(32) }));

      assertEquals(plan.schedule, null);
    }
  },
);

Deno.test("trendWeightOn is null with no weigh-in on or before the day", () => {
  assertEquals(trendWeightOn([], day(5)), null);
  assertEquals(trendWeightOn(goldenWeighIns, day(-1)), null);
});

Deno.test(
  "trendWeightOn is the newest trend point on or before the day, from the weigh-ins up to it",
  () => {
    assertAlmostEquals(trendWeightOn(goldenWeighIns, day(27)) ?? 0, 79.022685, 1e-6);
    assertAlmostEquals(trendWeightOn(goldenWeighIns, day(20)) ?? 0, 79.320994, 1e-6);
    assertAlmostEquals(
      trendWeightOn([...goldenWeighIns, { localDate: day(28), weightKg: 120 }], day(27)) ?? 0,
      79.022685,
      1e-6,
    );
  },
);

// The snapshots of a user whose start snapshot was written later than the check-in that is due. A
// rewrite keeps the start snapshot's own date, so it cannot happen through `recompute`, but the due mode
// does not rely on that: its prior is the newest snapshot dated before the date it runs.
const snapshotsWithALateStart = [
  { as_of_date: day(0), mu_kcal: 2500, var_kcal2: 140625 },
  { as_of_date: day(20), mu_kcal: 3000, var_kcal2: 90000 },
];

function fakeSnapshotRead(rows: typeof snapshotsWithALateStart) {
  const asked: (string | null)[] = [];
  return {
    asked,
    read: (before: string | null) => {
      asked.push(before);
      const newest = rows
        .filter(({ as_of_date }) => before === null || as_of_date < before)
        .sort((first, second) => second.as_of_date.localeCompare(first.as_of_date))[0];
      return Promise.resolve({ data: newest ?? null, error: null });
    },
  };
}

Deno.test(
  "readPriorBelief is the newest snapshot dated before the date it is asked for",
  async () => {
    const { read, asked } = fakeSnapshotRead(snapshotsWithALateStart);

    const prior = await readPriorBelief(read, day(14));

    assertEquals(prior, { muKcal: 2500, varKcal2: 140625 });
    assertEquals(asked, [day(14)]);
  },
);

Deno.test("readPriorBelief is the newest snapshot of all when no date is given", async () => {
  const { read } = fakeSnapshotRead(snapshotsWithALateStart);

  assertEquals(await readPriorBelief(read, null), { muKcal: 3000, varKcal2: 90000 });
});

Deno.test("readPriorBelief is null when no snapshot is dated before the date", async () => {
  const { read } = fakeSnapshotRead(snapshotsWithALateStart);

  assertEquals(await readPriorBelief(read, day(0)), null);
});

Deno.test("readPriorBelief throws the code of a failed read and nothing else", async () => {
  const read = () => Promise.resolve({ data: null, error: refusedWrite });

  const failure = await assertRejects(() => readPriorBelief(read, day(14)), Error);

  assertEquals(failure.message, "Reading expenditure_snapshots failed with code 23514");
});

function recordTargetsRpc(answer: { data: unknown; error: { code: string } | null }) {
  const sent: unknown[] = [];
  return {
    sent,
    rpc: (args: unknown) => {
      sent.push(args);
      return Promise.resolve(answer);
    },
  };
}

const targetsId = "0c5f8d4e-6b1a-4c3e-9d2f-7a8b9c0d1e2f";

Deno.test(
  "toRecordTargetsArguments sends the start snapshot, the targets and the schedule of a new plan",
  () => {
    const plan = planRecompute(recomputeReads());

    const args = toRecordTargetsArguments("user-id", "program-id", plan);

    assertEquals(Object.keys(args).sort(), [
      "p_checkin_weekday",
      "p_next_checkin_date",
      "p_start_snapshot",
      "p_targets",
      "p_user_id",
    ]);
    assertEquals(args.p_user_id, "user-id");
    assertEquals(args.p_next_checkin_date, "2026-11-07");
    assertEquals(args.p_checkin_weekday, 6);
    assertEquals(Object.keys(args.p_start_snapshot ?? {}).sort(), [
      "as_of_date",
      "engine_version",
      "measurement",
      "mu_kcal",
      "params",
      "program_id",
      "trend_weight_kg",
      "var_kcal2",
    ]);
    assertEquals(args.p_start_snapshot?.program_id, "program-id");
    assertEquals(args.p_start_snapshot?.measurement, null);
    assertEquals(Object.keys(args.p_targets).sort(), [
      "basis",
      "calories_kcal",
      "carbs_g",
      "dow_calories_kcal",
      "effective_from",
      "engine_version",
      "expenditure_snapshot_id",
      "fat_g",
      "params",
      "program_id",
      "protein_g",
    ]);
    assertEquals(args.p_targets.program_id, "program-id");
    assertEquals(args.p_targets.expenditure_snapshot_id, null);
    assertEquals(args.p_targets.effective_from, today);
  },
);

Deno.test(
  "toRecordTargetsArguments names the newest snapshot and sends no start snapshot or schedule for a none plan",
  () => {
    const plan = planRecompute(
      recomputeReads({
        newest: { id: "snapshot-2", kind: "checkin", as_of_date: day(18), mu_kcal: 2579.54 },
        nextCheckinDate: day(32),
      }),
    );

    const args = toRecordTargetsArguments("user-id", "program-id", plan);

    assertEquals(args.p_start_snapshot, null);
    assertEquals(args.p_next_checkin_date, null);
    assertEquals(args.p_checkin_weekday, null);
    assertEquals(args.p_targets.expenditure_snapshot_id, "snapshot-2");
  },
);

Deno.test(
  "callRecordTargets sends the arguments of the writer and answers the id of the new targets",
  async () => {
    const { rpc, sent } = recordTargetsRpc({ data: targetsId, error: null });
    const plan = planRecompute(recomputeReads());

    const id = await callRecordTargets(rpc, "user-id", "program-id", plan);

    assertEquals(id, targetsId);
    assertEquals(sent, [toRecordTargetsArguments("user-id", "program-id", plan)]);
  },
);

Deno.test("callRecordTargets refuses an answer that is not an id", async () => {
  const { rpc } = recordTargetsRpc({ data: "teapot", error: null });

  await assertRejects(() =>
    callRecordTargets(rpc, "user-id", "program-id", planRecompute(recomputeReads())),
  );
});

Deno.test("callRecordTargets throws the code of a refused write and none of the row", async () => {
  const { rpc } = recordTargetsRpc({ data: null, error: refusedWrite });

  const failure = await assertRejects(
    () => callRecordTargets(rpc, "user-id", "program-id", planRecompute(recomputeReads())),
    Error,
  );

  assertEquals(failure.message, "record_targets was refused with code 23514");
});

Deno.test("the log line of a recompute holds the user id, the branch and the duration only", () => {
  assertEquals(
    recomputeLogLine({ userId: "0c5f8d4e", branch: "rewrite", durationMilliseconds: 87 }),
    "run-checkin recompute user=0c5f8d4e branch=rewrite duration_ms=87",
  );
});

Deno.test(
  "a recompute reads weigh-ins back 119 days: 29 for the oldest rewrite's day before, 90 to warm up",
  () => {
    assertEquals(recomputeWeighInDays, 119);
  },
);

Deno.test(
  "planRecompute sets a schedule of today plus 14 for a new start snapshot when the next date is overdue",
  () => {
    for (const nextCheckinDate of [day(21), today]) {
      const plan = planRecompute(
        recomputeReads({
          nextCheckinDate,
          newest: { id: "snapshot-2", kind: "checkin", as_of_date: day(-7), mu_kcal: 2579.54 },
        }),
      );

      assertEquals(plan.branch, "new");
      assertEquals(plan.schedule, { nextCheckinDate: "2026-11-07", checkinWeekday: 6 });
    }
  },
);

Deno.test("planRecompute leaves a next date after today alone for a new start snapshot", () => {
  const plan = planRecompute(
    recomputeReads({
      nextCheckinDate: day(29),
      newest: { id: "snapshot-2", kind: "checkin", as_of_date: day(-7), mu_kcal: 2579.54 },
    }),
  );

  assertEquals(plan.branch, "new");
  assertEquals(plan.schedule, null);
});

Deno.test("planRecompute leaves an overdue next date alone when the branch is not new", () => {
  const plan = planRecompute(
    recomputeReads({
      nextCheckinDate: day(21),
      newest: { id: "snapshot-2", kind: "checkin", as_of_date: day(18), mu_kcal: 2579.54 },
    }),
  );

  assertEquals(plan.branch, "none");
  assertEquals(plan.schedule, null);
});

Deno.test("planRecompute passes the floor's BMR of 1755 for the golden profile", () => {
  assertEquals(planRecompute(recomputeReads()).targets.basis.bmrKcal, 1755);
});

Deno.test(
  "planRecompute works the start snapshot at the age on its date and the floor at the age today",
  () => {
    // Born 1991-10-20: 34 on day 18 (2026-10-14), the rewritten snapshot's date, and 35 on day 28.
    const stats = { ...goldenStats, birthDate: "1991-10-20" };

    const plan = planRecompute(
      recomputeReads({
        stats,
        newest: { id: "snapshot-1", kind: "start", as_of_date: day(18), mu_kcal: 2000 },
      }),
    );

    // Mifflin-St Jeor is 1760 at 34 and 1755 at 35, and the factor of "light" is 1.375.
    assertAlmostEquals(plan.startSnapshot?.mu_kcal ?? 0, 2420, 1e-9);
    assertEquals(plan.targets.basis.bmrKcal, 1755);
  },
);

Deno.test("callRecordTargets reads a code that is not a short code as unknown", async () => {
  const { rpc } = recordTargetsRpc({ data: null, error: { code: refusedWrite.details } });

  const failure = await assertRejects(
    () => callRecordTargets(rpc, "user-id", "program-id", planRecompute(recomputeReads())),
    Error,
  );

  assertEquals(failure.message, "record_targets was refused with code unknown");
  for (const value of healthValues) {
    assertEquals(failure.message.includes(value), false);
  }
});

Deno.test(
  "planRecompute leaves an overdue next date alone when the start snapshot is rewritten",
  () => {
    const plan = planRecompute(
      recomputeReads({
        nextCheckinDate: day(21),
        newest: { id: "snapshot-1", kind: "start", as_of_date: day(18), mu_kcal: 2000 },
      }),
    );

    assertEquals(plan.branch, "rewrite");
    assertEquals(plan.schedule, null);
  },
);
