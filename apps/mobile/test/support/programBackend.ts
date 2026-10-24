import { addCalendarDays } from "@keylow/core/dates";
import {
  checkinStep,
  profileBmr,
  startSnapshot,
  targetsRow,
  toDayInputs,
  updateExpenditure,
} from "@keylow/core/engine";
import { goldenCheckinFixture, ineligibleCheckinFixture } from "@keylow/core/testing";
import { createClient } from "@supabase/supabase-js";

import { diaryBackend, fakeFetch as diaryFetch } from "./diaryBackend";

import type { Database } from "@keylow/api-client";
import type {
  CheckinMeasurement,
  CheckinProgram,
  EligibleMeasurement,
  EngineTargetsRow,
  ProfileStats,
} from "@keylow/core/engine";

type Row = Record<string, unknown>;

/*
 * The programme reads of the Programme screen and the Programme row of More, over the diary's fake database
 * (its terms, its time zone, its targets and its `programs` and `targets` tables). Every figure of the two
 * people below is worked out by core's own functions, the ones the check-in and the recompute call, so no
 * number is typed here. The tests state the figures as literals.
 */

export const PROGRAM_ID = "55555555-5555-4555-8555-555555555555";

type SetupProfile = {
  sex: string | null;
  birth_date: string | null;
  height_cm: number | null;
  activity: string | null;
  weight_unit: string | null;
  onboarding_completed_at: string | null;
};

export const programBackend: {
  /** The `expenditure_snapshots` rows, in any order. */
  snapshots: Row[];
  /** The profile columns the setup read asks for, which the program-without-snapshot case reads. */
  setupProfile: SetupProfile;
  /** The weight unit of the profile. */
  weightUnit: string;
  /**
   * The `weigh_ins` rows, newest first, as `weight_kg` and `local_date`. The setup read takes the newest of them,
   * and the weigh-in list reads them all, each with the other columns the list needs filled in.
   */
  weighIns: Row[];
  /** Fails the targets history read, which the check-in card makes, and leaves the other targets reads alone. */
  targetsHistoryFails: boolean;
  /** Fails the expenditure history read, which the chart and the check-in card make, and leaves the summary alone. */
  expenditureHistoryFails: boolean;
} = {
  snapshots: [],
  setupProfile: {
    sex: null,
    birth_date: null,
    height_cm: null,
    activity: null,
    weight_unit: null,
    onboarding_completed_at: null,
  },
  weightUnit: "kg",
  weighIns: [],
  targetsHistoryFails: false,
  expenditureHistoryFails: false,
};

export function resetProgramBackend(): void {
  programBackend.snapshots = [];
  programBackend.setupProfile = {
    sex: null,
    birth_date: null,
    height_cm: null,
    activity: null,
    weight_unit: null,
    onboarding_completed_at: null,
  };
  programBackend.weightUnit = "kg";
  programBackend.weighIns = [];
  programBackend.targetsHistoryFails = false;
  programBackend.expenditureHistoryFails = false;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A weigh-in as the list reads it: the columns the setup read leaves out are filled in, and any the row gives are kept. */
function listedWeighIn(row: Row, index: number): Row {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    measured_at: `${String(row["local_date"])}T08:00:00+00:00`,
    tz: "Europe/London",
    source: "manual",
    note: null,
    ...row,
  };
}

export async function programFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const { pathname, searchParams } = new URL(address);
  const table = pathname.split("/").pop() ?? "";
  const select = searchParams.get("select") ?? "";
  const ownsTable = table === "expenditure_snapshots" || table === "weigh_ins";
  const ownsProfile =
    table === "profiles" && (select === "weight_unit" || select.startsWith("sex,"));
  // The history read asks for the rows oldest first, which the diary's fake database does not honour.
  const ownsTargetsHistory =
    table === "targets" && (searchParams.get("order") ?? "").startsWith("effective_from.asc");
  if (!ownsTable && !ownsProfile && !ownsTargetsHistory) {
    return diaryFetch(input, init);
  }

  diaryBackend.requests.push({ table, search: searchParams.toString(), method: "GET" });
  if (diaryBackend.hungTables.has(table)) {
    return new Promise(() => undefined);
  }
  if (diaryBackend.failingTables.has(table)) {
    return jsonResponse(
      { code: "XX000", message: "raw database text", details: null, hint: null },
      500,
    );
  }
  if (ownsTargetsHistory) {
    if (programBackend.targetsHistoryFails) {
      return jsonResponse(
        { code: "XX000", message: "raw database text", details: null, hint: null },
        500,
      );
    }
    return jsonResponse(
      // Oldest first, and by id among the rows of one day, as the table's own order does.
      [...diaryBackend.engineTargets].sort(
        (first, second) =>
          String(first["effective_from"]).localeCompare(String(second["effective_from"])) ||
          String(first["id"]).localeCompare(String(second["id"])),
      ),
    );
  }
  if (table === "expenditure_snapshots") {
    // The summary asks for the newest first and the history for the oldest first.
    const direction = (searchParams.get("order") ?? "").includes(".asc") ? 1 : -1;
    if (direction === 1 && programBackend.expenditureHistoryFails) {
      return jsonResponse(
        { code: "XX000", message: "raw database text", details: null, hint: null },
        500,
      );
    }
    return jsonResponse(
      [...programBackend.snapshots].sort(
        (first, second) =>
          direction * String(first["as_of_date"]).localeCompare(String(second["as_of_date"])),
      ),
    );
  }
  if (table === "weigh_ins") {
    return jsonResponse(
      searchParams.get("limit") === "1"
        ? programBackend.weighIns.slice(0, 1)
        : programBackend.weighIns.map(listedWeighIn),
    );
  }
  if (select === "weight_unit") {
    return jsonResponse([{ weight_unit: programBackend.weightUnit }]);
  }
  return jsonResponse([programBackend.setupProfile]);
}

/** A real Supabase client whose network is the diary's fake database and, beside it, the programme tables. */
export const programClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: programFetch },
});

const NO_DAY_OFFSETS = [0, 0, 0, 0, 0, 0, 0] as const;

type ProgramColumns = {
  goal: string;
  rate_pct_per_week: number;
  protein_g_per_kg: number;
  fat_fraction_of_remaining: number;
  split_preset: string;
};

const MODERATE_BALANCED_LOSE: ProgramColumns = {
  goal: "lose",
  rate_pct_per_week: 0.5,
  protein_g_per_kg: 1.6,
  fat_fraction_of_remaining: 0.4,
  split_preset: "balanced",
};

function programRow(
  startedOn: string,
  nextCheckinDate: string | null,
  columns: ProgramColumns = MODERATE_BALANCED_LOSE,
): Row {
  return {
    id: PROGRAM_ID,
    ...columns,
    started_on: startedOn,
    next_checkin_date: nextCheckinDate,
    ended_on: null,
  };
}

function snapshotRow(
  index: number,
  snapshot: {
    kind: string;
    as_of_date: string;
    mu_kcal: number;
    var_kcal2: number;
    measurement: unknown;
  },
): Row {
  return {
    id: `66666666-6666-4666-8666-66666666666${index}`,
    program_id: PROGRAM_ID,
    as_of_date: snapshot.as_of_date,
    kind: snapshot.kind,
    mu_kcal: snapshot.mu_kcal,
    var_kcal2: snapshot.var_kcal2,
    measurement: snapshot.measurement,
  };
}

function targetsDatabaseRow(
  index: number,
  row: {
    effective_from: string;
    calories_kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    dow_calories_kcal: readonly number[];
    basis: unknown;
  },
  effectiveTo: string | null,
): Row {
  return {
    id: `77777777-7777-4777-8777-77777777777${index}`,
    program_id: PROGRAM_ID,
    effective_from: row.effective_from,
    effective_to: effectiveTo,
    calories_kcal: row.calories_kcal,
    protein_g: row.protein_g,
    fat_g: row.fat_g,
    carbs_g: row.carbs_g,
    dow_calories_kcal: row.dow_calories_kcal,
    basis: row.basis,
  };
}

const GOLDEN_DAY_ZERO = "2026-09-25";

/**
 * The golden fixture after its third check-in (the canvas's Friday 23 October, days 14, 21 and 28 from Friday
 * 25 September): the three check-ins are run through `checkinStep`, each from the last one's belief. The
 * database then holds the three snapshots, the targets of the third check-in as the open row, and the second's
 * as the one before it. The next check-in is Friday 30 October.
 */
export function showGoldenProgram(): void {
  const fixture = goldenCheckinFixture(GOLDEN_DAY_ZERO);
  const days = toDayInputs(fixture.dayTotals, fixture.dayLogs);
  let belief = fixture.prior;
  const results = [14, 21, 28].map((daysAfterDayZero) => {
    const result = checkinStep({
      asOfDate: addCalendarDays(GOLDEN_DAY_ZERO, daysAfterDayZero),
      prior: belief,
      weighIns: fixture.weighIns,
      days,
      program: fixture.program,
      bmrKcal: fixture.bmrKcal,
    });
    belief = { muKcal: result.snapshot.mu_kcal, varKcal2: result.snapshot.var_kcal2 };
    return result;
  });

  diaryBackend.programs = [programRow(GOLDEN_DAY_ZERO, "2026-10-30")];
  programBackend.snapshots = results.map(({ snapshot }, index) => snapshotRow(index, snapshot));
  const [, second, third] = results;
  if (second === undefined || third === undefined) {
    throw new Error("The golden run has three check-ins");
  }
  diaryBackend.engineTargets = [
    targetsDatabaseRow(2, third.targets, null),
    targetsDatabaseRow(1, second.targets, third.targets.effective_from),
  ];
}

/** The setup canvas's sample man: male, 35 on 23 October 2026, 180 cm, 80.0 kg, lightly active, lose 0.5%. */
export const SAMPLE_MAN: {
  stats: ProfileStats;
  weightKg: number;
  setupProfile: SetupProfile;
} = {
  stats: { sex: "male", birthDate: "1991-03-14", heightCm: 180, activity: "light" },
  weightKg: 80,
  setupProfile: {
    sex: "male",
    birth_date: "1991-03-14",
    height_cm: 180,
    activity: "light",
    weight_unit: "kg",
    onboarding_completed_at: "2026-10-23T09:00:00+00:00",
  },
};

const SET_UP_ON = "2026-10-23";

function sampleManProgram(): CheckinProgram {
  return {
    goal: "lose",
    ratePctPerWeek: 0.5,
    proteinGPerKg: 1.6,
    fatFraction: 0.4,
    dowOffsetsKcal: NO_DAY_OFFSETS,
  };
}

/** The sample man's account as the wizard and its first recompute leave it: a program, a start snapshot and targets. */
export function showSettlingProgram(): void {
  const start = startSnapshot({
    stats: SAMPLE_MAN.stats,
    onboardingWeightKg: SAMPLE_MAN.weightKg,
    asOfDate: SET_UP_ON,
    trendWeightKg: SAMPLE_MAN.weightKg,
  });
  const targets = targetsRow({
    source: "start",
    effectiveFrom: SET_UP_ON,
    muKcal: start.mu_kcal,
    trendWeightKg: SAMPLE_MAN.weightKg,
    program: sampleManProgram(),
    bmrKcal: profileBmr(SAMPLE_MAN.stats, SAMPLE_MAN.weightKg, SET_UP_ON),
  });

  diaryBackend.programs = [programRow(SET_UP_ON, "2026-11-06")];
  programBackend.snapshots = [snapshotRow(0, start)];
  diaryBackend.engineTargets = [targetsDatabaseRow(1, targets, null)];
  programBackend.setupProfile = SAMPLE_MAN.setupProfile;
  programBackend.weighIns = [{ weight_kg: SAMPLE_MAN.weightKg, local_date: SET_UP_ON }];
}

/**
 * The sample man between the wizard's save and the first recompute: a program saved with no schedule, no
 * snapshot and no targets row of its own, and the manual targets the wizard saved on the profile.
 */
export function showProgramWithoutSnapshot(): void {
  const targets = targetsRow({
    source: "start",
    effectiveFrom: SET_UP_ON,
    muKcal: startSnapshot({
      stats: SAMPLE_MAN.stats,
      onboardingWeightKg: SAMPLE_MAN.weightKg,
      asOfDate: SET_UP_ON,
      trendWeightKg: SAMPLE_MAN.weightKg,
    }).mu_kcal,
    trendWeightKg: SAMPLE_MAN.weightKg,
    program: sampleManProgram(),
    bmrKcal: profileBmr(SAMPLE_MAN.stats, SAMPLE_MAN.weightKg, SET_UP_ON),
  });

  diaryBackend.programs = [programRow(SET_UP_ON, null)];
  programBackend.snapshots = [];
  diaryBackend.engineTargets = [];
  diaryBackend.targets = {
    target_kcal: targets.calories_kcal,
    target_protein_g: targets.protein_g,
    target_carbs_g: targets.carbs_g,
    target_fat_g: targets.fat_g,
  };
  programBackend.setupProfile = SAMPLE_MAN.setupProfile;
  programBackend.weighIns = [{ weight_kg: SAMPLE_MAN.weightKg, local_date: SET_UP_ON }];
}

const FIRST_CHECKIN_AFTER = 14;

/** The golden person's first check-in, Friday 9 October (day 14 from Friday 25 September). */
export const FIRST_CHECKIN_DATE = addCalendarDays(GOLDEN_DAY_ZERO, FIRST_CHECKIN_AFTER);

type StartRow = {
  kind: "start";
  as_of_date: string;
  mu_kcal: number;
  var_kcal2: number;
  measurement: null;
};

type CheckinRow = {
  kind: "checkin";
  as_of_date: string;
  mu_kcal: number;
  var_kcal2: number;
  measurement: CheckinMeasurement;
};

type CheckinCase = {
  program: ProgramColumns;
  start: StartRow;
  startTargets: EngineTargetsRow<"start">;
  checkin: { snapshot: CheckinRow; targets: EngineTargetsRow<"checkin"> };
};

/** An edit or a recalculation after the check-in: a recompute row opens on `recomputedOn` and closes the check-in's row. */
export type Recompute = { recomputedOn: string; ratePctPerWeek: number };

/**
 * A programme with a start snapshot and one check-in, as the database holds them: the start row closed on the
 * check-in's day and the check-in's row open, or closed by a recompute row when one is given. The rows are
 * newest first, as the programme summary reads them.
 */
function showCheckinCase(
  { program, start, startTargets, checkin }: CheckinCase,
  recompute?: Recompute,
): void {
  const rows = [
    targetsDatabaseRow(1, checkin.targets, recompute?.recomputedOn ?? null),
    targetsDatabaseRow(0, startTargets, checkin.snapshot.as_of_date),
  ];
  if (recompute !== undefined) {
    const recomputed = targetsRow({
      source: "recompute",
      effectiveFrom: recompute.recomputedOn,
      muKcal: checkin.snapshot.mu_kcal,
      trendWeightKg: checkin.targets.basis.trendWeightKg,
      program: {
        goal: "lose",
        ratePctPerWeek: recompute.ratePctPerWeek,
        proteinGPerKg: program.protein_g_per_kg,
        fatFraction: program.fat_fraction_of_remaining,
        dowOffsetsKcal: NO_DAY_OFFSETS,
      },
      bmrKcal: checkin.targets.basis.bmrKcal,
    });
    rows.unshift(targetsDatabaseRow(2, recomputed, null));
  }

  diaryBackend.programs = [programRow(GOLDEN_DAY_ZERO, "2026-10-16", program)];
  programBackend.snapshots = [snapshotRow(0, start), snapshotRow(1, checkin.snapshot)];
  diaryBackend.engineTargets = rows;
}

/** The golden person's first check-in, run through `checkinStep` on the weigh-ins of `weighInDays` (all of them by default). */
function goldenCase(
  fixture: ReturnType<typeof goldenCheckinFixture>,
  weighInDays?: readonly number[],
): CheckinCase {
  const { snapshot, targets } = checkinStep({
    asOfDate: FIRST_CHECKIN_DATE,
    prior: fixture.prior,
    weighIns:
      weighInDays === undefined
        ? fixture.weighIns
        : fixture.weighIns.filter((_, day) => weighInDays.includes(day)),
    days: toDayInputs(fixture.dayTotals, fixture.dayLogs),
    program: fixture.program,
    bmrKcal: fixture.bmrKcal,
  });
  return {
    program: MODERATE_BALANCED_LOSE,
    start: {
      kind: "start",
      as_of_date: GOLDEN_DAY_ZERO,
      mu_kcal: fixture.prior.muKcal,
      var_kcal2: fixture.prior.varKcal2,
      measurement: null,
    },
    startTargets: targetsRow({
      source: "start",
      effectiveFrom: GOLDEN_DAY_ZERO,
      muKcal: fixture.prior.muKcal,
      trendWeightKg: 80,
      program: fixture.program,
      bmrKcal: fixture.bmrKcal,
    }),
    checkin: { snapshot, targets },
  };
}

/** The golden day 14 check-in of the canvas (Friday 9 October), which measured: 2,500 to 2,560 kcal, 2,060 to 2,120. */
export function showGoldenFirstCheckin(recompute?: Recompute): void {
  showCheckinCase(goldenCase(goldenCheckinFixture(GOLDEN_DAY_ZERO)), recompute);
}

/** The golden day 14 check-in with 9 complete days (Q8): it could not measure. */
export function showNineCompleteDaysCheckin(): void {
  showCheckinCase(goldenCase(ineligibleCheckinFixture(GOLDEN_DAY_ZERO)));
}

/** The golden day 14 check-in with weigh-ins on days 5, 6, 8, 11 and 13 only: it could not measure, for two reasons. */
export function showFiveWeighInDaysCheckin(): void {
  showCheckinCase(goldenCase(goldenCheckinFixture(GOLDEN_DAY_ZERO), [5, 6, 8, 11, 13]));
}

type InventedCheckin = {
  stats: ProfileStats;
  startWeightKg: number;
  trendWeightKg: number;
  program: ProgramColumns;
  /** The expenditure the window implies and its variance: made up, as the canvas does, to reach the guardrail. */
  zKcal: number;
  rKcal2: number;
};

/** A check-in whose measurement is made up (the canvas's `z` and `R_eff`), run through core's own update and targets. */
function inventedCase({
  stats,
  startWeightKg,
  trendWeightKg,
  program: columns,
  zKcal,
  rKcal2,
}: InventedCheckin): CheckinCase {
  const program: CheckinProgram = {
    goal: "lose",
    ratePctPerWeek: columns.rate_pct_per_week,
    proteinGPerKg: columns.protein_g_per_kg,
    fatFraction: columns.fat_fraction_of_remaining,
    dowOffsetsKcal: NO_DAY_OFFSETS,
  };
  const started = startSnapshot({
    stats,
    onboardingWeightKg: startWeightKg,
    asOfDate: GOLDEN_DAY_ZERO,
    trendWeightKg: startWeightKg,
  });
  const bmrKcal = profileBmr(stats, startWeightKg, GOLDEN_DAY_ZERO);
  const measurement: EligibleMeasurement = {
    eligible: true,
    zKcal,
    rKcal2,
    slopeKgPerDay: 0,
    seSlopeKg: 0,
    meanIntakeKcal: zKcal,
    spanDays: 14,
    weighDays: 14,
    completeDays: 14,
  };
  const update = updateExpenditure(
    { muKcal: started.mu_kcal, varKcal2: started.var_kcal2 },
    measurement,
  );
  const { gain, rawStepKcal, stepKcal, stepClamped } = update;

  return {
    program: columns,
    start: {
      kind: "start",
      as_of_date: GOLDEN_DAY_ZERO,
      mu_kcal: started.mu_kcal,
      var_kcal2: started.var_kcal2,
      measurement: null,
    },
    startTargets: targetsRow({
      source: "start",
      effectiveFrom: GOLDEN_DAY_ZERO,
      muKcal: started.mu_kcal,
      trendWeightKg: startWeightKg,
      program,
      bmrKcal,
    }),
    checkin: {
      snapshot: {
        kind: "checkin",
        as_of_date: FIRST_CHECKIN_DATE,
        mu_kcal: update.muKcal,
        var_kcal2: update.varKcal2,
        measurement: { ...measurement, gain, rawStepKcal, stepKcal, stepClamped },
      },
      targets: targetsRow({
        source: "checkin",
        effectiveFrom: FIRST_CHECKIN_DATE,
        muKcal: update.muKcal,
        trendWeightKg,
        program,
        bmrKcal,
      }),
    },
  };
}

/** Guardrails A: the setup canvas's max-deficit man (male, 40, 175 cm, 130.0 kg, moderately active, lose 1.0%). */
export function showMaxDeficitCheckin(): void {
  showCheckinCase(
    inventedCase({
      stats: { sex: "male", birthDate: "1986-03-14", heightCm: 175, activity: "moderate" },
      startWeightKg: 130,
      trendWeightKg: 128.4,
      program: { ...MODERATE_BALANCED_LOSE, rate_pct_per_week: 1 },
      zKcal: 2900,
      rKcal2: 60000,
    }),
  );
}

/** Guardrails B: the floor-above-expenditure woman (50, 150 cm, 40.0 kg, sedentary, lose 0.5%). */
export function showFloorAboveExpenditureCheckin(): void {
  showCheckinCase(
    inventedCase({
      stats: { sex: "female", birthDate: "1976-03-14", heightCm: 150, activity: "sedentary" },
      startWeightKg: 40,
      trendWeightKg: 39.9,
      program: MODERATE_BALANCED_LOSE,
      zKcal: 1080,
      rKcal2: 25000,
    }),
  );
}
