import {
  addCalendarDays,
  buildQuickEntry,
  checkinWeekday,
  edgeErrorSchema,
  localToday,
  runCheckinBackstopResponseSchema,
  runCheckinRecomputeResponseSchema,
  runCheckinResponseSchema,
} from "@keylow/core";
import { goldenCheckinFixture } from "@keylow/core/testing";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { callFunction } from "../support/functionClient";
import { requireServedFunction } from "../support/functionsLane";
import { adminClient } from "../support/stack";
import { requireFunctionEnvironmentValue } from "../support/testEnvironment";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { Json } from "../../../src/types.gen";
import type { TestUser } from "../support/users";

/*
 * `run-checkin` in its due, recompute and backstop modes, over HTTP against the served function, with real user JWTs.
 *
 * Every user is built from the golden run of ADR 0002, Amendment 2 (`goldenCheckinFixture`), with day 0
 * twenty-eight days before today in UTC (a profile's time zone is UTC unless it is changed). The
 * program started on day 0, the start snapshot is 2500 / 140 625 on day 0, and the first check-in is
 * due on day 14, so a call on day 28 owes three. The expected figures are the ADR's, as literals.
 *
 * How the rows get there. The tables are written by the user's own client or by the two writer
 * functions, because the service role has no insert on the snapshots and targets and the users have
 * column grants only:
 *   - the profile's stats, the program, the weigh-ins, the diary entries and the day logs: the user's
 *     own client, under the owner-only policies and column grants
 *   - the start snapshot and the start targets: `record_targets` with the admin client, as the
 *     api-client's program suite does
 * The suite assumes the run does not cross UTC midnight, because the function reads its own clock.
 */

const ENGINE_VERSION = "keylow-engine-v1";

const today = localToday(new Date().toISOString(), "UTC");
const day0 = addCalendarDays(today, -28);
const day = (offset: number) => addCalendarDays(day0, offset);
const fixture = goldenCheckinFixture(day0);

const startTargets = (programId: string, effectiveFrom: string = day0): Json => ({
  program_id: programId,
  effective_from: effectiveFrom,
  calories_kcal: 2150,
  protein_g: 126,
  fat_g: 73,
  carbs_g: 247,
  dow_calories_kcal: [2150, 2150, 2150, 2150, 2150, 2150, 2150],
  basis: {
    source: "start",
    tdeeKcal: 2500,
    trendWeightKg: 80,
    bmrKcal: 1755,
    goal: "lose",
    ratePctPerWeek: 0.5,
    effectiveRatePctPerWeek: 0.5,
    proteinGPerKg: 1.6,
    fatFraction: 0.4,
    dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
    clamps: [],
  },
  engine_version: ENGINE_VERSION,
  params: {},
});

// Male, 180 cm, 80 kg: with this birth date he is 35 on every check-in date, and Mifflin-St Jeor is 1755.
const birthDate = addCalendarDays(today, -(35 * 365 + 183));

type GoldenUserOptions = {
  /** Replaces the golden birth date. Null leaves the profile without one. */
  birthDate?: string | null;
  /** Replaces day 14. */
  nextCheckinDate?: string;
  /** Replaces the golden weigh-in of 80 - 0.05 * day kg. */
  weightKgOnDay?: (day: number) => number;
  /** Replaces the golden intake of 2200 kcal a day. */
  intakeKcal?: number;
  /** Leaves the user without a program, snapshots or diary. */
  withoutProgram?: boolean;
  /** Replaces the start snapshot's date, day 0. */
  startDate?: string;
  /** Replaces the start snapshot's 2500 kcal. */
  startMuKcal?: number;
  /** Replaces the start snapshot's 140 625. */
  startVarKcal2?: number;
  /** Writes every day log as not complete. */
  dayLogsNotComplete?: boolean;
  /** Adds a weigh-in on day 5 that is soft deleted straight away, and would move every figure if read. */
  softDeletedOutlier?: boolean;
  /** Records the golden day 14 check-in through the writer before the test calls, so the user has resumed. */
  day14AlreadyRecorded?: boolean;
};

function expectNoError(error: { code: string } | null, what: string) {
  // The code only: a database message can quote the row.
  expect(error === null ? null : `${what} failed with ${error.code}`).toBeNull();
}

async function createGoldenUser(options: GoldenUserOptions = {}): Promise<TestUser> {
  const user = await createTestUser("key612");
  if (options.withoutProgram === true) {
    return user;
  }

  const profile = await user.client
    .from("profiles")
    .update({
      sex: "male",
      birth_date: options.birthDate === undefined ? birthDate : options.birthDate,
      height_cm: 180,
      activity: "light",
      onboarding_weight_kg: 80,
    })
    .eq("id", user.id);
  expectNoError(profile.error, "the profile update");

  const program = await user.client
    .from("programs")
    .insert({
      goal: "lose",
      rate_pct_per_week: 0.5,
      protein_g_per_kg: 1.6,
      fat_fraction_of_remaining: 0.4,
      split_preset: "balanced",
      started_on: day0,
      next_checkin_date: options.nextCheckinDate ?? day(14),
    })
    .select("id")
    .single();
  expectNoError(program.error, "the program insert");
  const programId = program.data?.id ?? "";

  const weighIns = await user.client.from("weigh_ins").insert(
    fixture.weighIns.map(({ localDate }, index) => ({
      measured_at: `${localDate}T07:00:00Z`,
      local_date: localDate,
      tz: "UTC",
      weight_kg: Number(
        (options.weightKgOnDay?.(index) ?? fixture.weighIns[index]?.weightKg ?? 0).toFixed(3),
      ),
      source: "manual" as const,
    })),
  );
  expectNoError(weighIns.error, "the weigh-in insert");

  if (options.softDeletedOutlier === true) {
    // 81 kg beside day 5's 79.75 is inside the trend's clamp, so a read that kept it would move the
    // slope and with it every check-in.
    const outlier = await user.client
      .from("weigh_ins")
      .insert({
        measured_at: `${day(5)}T20:00:00Z`,
        local_date: day(5),
        tz: "UTC",
        weight_kg: 81,
        source: "manual" as const,
      })
      .select("id")
      .single();
    expectNoError(outlier.error, "the outlier insert");
    const removed = await user.client
      .from("weigh_ins")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", outlier.data?.id ?? "");
    expectNoError(removed.error, "the outlier soft delete");
  }

  const entries = await user.client.from("food_log_entries").insert(
    fixture.dayTotals.flatMap(({ local_date, kcal }) =>
      kcal === null
        ? []
        : [
            buildQuickEntry({
              kcal: options.intakeKcal ?? kcal,
              localDate: local_date,
              loggedAt: `${local_date}T12:00:00+00:00`,
            }),
          ],
    ),
  );
  expectNoError(entries.error, "the diary insert");

  const dayLogs = await user.client.from("day_logs").insert(
    fixture.dayLogs.map(({ local_date, is_complete }) => ({
      local_date,
      is_complete: options.dayLogsNotComplete === true ? false : is_complete,
    })),
  );
  expectNoError(dayLogs.error, "the day log insert");

  const start = await adminClient().rpc("record_targets", {
    p_user_id: user.id,
    p_targets: startTargets(programId),
    p_start_snapshot: {
      program_id: programId,
      as_of_date: options.startDate ?? day0,
      mu_kcal: options.startMuKcal ?? 2500,
      var_kcal2: options.startVarKcal2 ?? 140625,
      measurement: null,
      trend_weight_kg: null,
      engine_version: ENGINE_VERSION,
      params: {},
    },
    p_next_checkin_date: options.nextCheckinDate ?? day(14),
    p_checkin_weekday: checkinWeekday(day0),
  });
  expectNoError(start.error, "the start snapshot");

  if (options.day14AlreadyRecorded === true) {
    // The golden day 14 figures as literals. The measurement is what an eligible check-in stores.
    const recorded = await adminClient().rpc("record_checkin", {
      p_user_id: user.id,
      p_snapshot: {
        program_id: programId,
        as_of_date: day(14),
        mu_kcal: 2559.56,
        var_kcal2: 43771.7,
        measurement: {
          eligible: true,
          zKcal: 2585,
          rKcal2: 62467.9,
          slopeKgPerDay: -0.05,
          seSlopeKg: 0.0198898,
          meanIntakeKcal: 2200,
          spanDays: 14,
          weighDays: 14,
          completeDays: 14,
          gain: 0.70071,
          rawStepKcal: 59.56,
          stepKcal: 59.56,
          stepClamped: false,
        },
        trend_weight_kg: null,
        engine_version: ENGINE_VERSION,
        params: { version: ENGINE_VERSION },
      },
      p_targets: startTargets(programId),
      p_next_checkin_date: day(21),
    });
    expectNoError(recorded.error, "the day 14 check-in");
    expect(recorded.data).toBe("recorded");
  }

  return user;
}

// A user whose only program has ended, with the check-in still due on its stored date.
async function createUserWithEndedProgram(): Promise<TestUser> {
  const user = await createTestUser("key612");
  const program = await user.client.from("programs").insert({
    goal: "lose",
    rate_pct_per_week: 0.5,
    protein_g_per_kg: 1.6,
    fat_fraction_of_remaining: 0.4,
    split_preset: "balanced",
    started_on: day0,
    ended_on: day(10),
    next_checkin_date: day(14),
  });
  expectNoError(program.error, "the ended program insert");
  return user;
}

async function readSnapshots(user: TestUser) {
  const { data, error } = await adminClient()
    .from("expenditure_snapshots")
    .select("id, as_of_date, kind, mu_kcal, var_kcal2, trend_weight_kg, engine_version, params")
    .eq("user_id", user.id)
    .order("as_of_date");
  expectNoError(error, "the snapshot read");
  return data ?? [];
}

async function readCheckinSnapshots(user: TestUser) {
  return (await readSnapshots(user)).filter(({ kind }) => kind === "checkin");
}

async function readTargets(user: TestUser) {
  const { data, error } = await adminClient()
    .from("targets")
    .select(
      "id, expenditure_snapshot_id, effective_from, effective_to, calories_kcal, protein_g, fat_g, carbs_g, basis, engine_version, params",
    )
    .eq("user_id", user.id)
    .order("effective_from")
    .order("created_at");
  expectNoError(error, "the targets read");
  return data ?? [];
}

async function readNextCheckinDate(user: TestUser) {
  const { data, error } = await adminClient()
    .from("programs")
    .select("next_checkin_date")
    .eq("user_id", user.id)
    .single();
  expectNoError(error, "the program read");
  return data?.next_checkin_date ?? null;
}

async function readCheckinWeekday(user: TestUser) {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("checkin_weekday")
    .eq("id", user.id)
    .single();
  expectNoError(error, "the profile read");
  return data?.checkin_weekday ?? null;
}

async function runRecompute(user: TestUser) {
  return await callFunction("run-checkin", {
    accessToken: user.accessToken,
    body: { mode: "recompute" },
  });
}

async function runDue(user: TestUser) {
  return await callFunction("run-checkin", {
    accessToken: user.accessToken,
    body: { mode: "due" },
  });
}

// The ADR's golden figures, to the precision it gives them (Amendment 2, "Golden numbers"). Passing
// `toBeCloseTo(value, 0)` means within 0.5, which is the tolerance the exit gate names.
const goldenCheckins = [
  { date: day(14), muKcal: 2559.56, varKcal2: 43771.7 },
  { date: day(21), muKcal: 2574.22, varKcal2: 20939.4 },
  { date: day(28), muKcal: 2579.54, varKcal2: 13449.0 },
];

function expectGoldenChain(snapshots: Awaited<ReturnType<typeof readCheckinSnapshots>>) {
  expect(snapshots.map(({ as_of_date }) => as_of_date)).toEqual(
    goldenCheckins.map(({ date }) => date),
  );
  snapshots.forEach((snapshot, index) => {
    expect(snapshot.mu_kcal).toBeCloseTo(goldenCheckins[index]?.muKcal ?? 0, 0);
    expect(snapshot.var_kcal2).toBeCloseTo(goldenCheckins[index]?.varKcal2 ?? 0, 0);
    expect(snapshot.engine_version).toBe(ENGINE_VERSION);
    expect(snapshot.params).toHaveProperty("version", ENGINE_VERSION);
  });
}

// Three users due on the same dates, whose rows would change a golden figure if the function read them.
// Each field pins one read:
//   - weigh-ins of 100 kg (the day's median moves) pin the weigh-in filter
//   - intake of 3000 kcal pins the day_totals filter
//   - day logs that are not complete pin the day_logs filter, because the function would then read the
//     user's days as incomplete
//   - a start snapshot of 3000 / 90 000 dated day 13, newer than every golden start snapshot, pins the
//     snapshot filter, because the newest snapshot of anyone would then be the prior
// The function refuses a day_totals or day_logs read that holds two rows for one date, so a missing
// user filter on either table answers 500 for the golden user, whatever order the rows come back in.
// The decoys share the golden dates, which is what makes that check fire. Weigh-ins may be several
// on a day, so their filter is pinned by the 100 kg readings moving the day's median instead.
let decoysPromise: Promise<TestUser[]> | undefined;

function getDecoys(): Promise<TestUser[]> {
  decoysPromise ??= Promise.all(
    [1, 2, 3].map(() =>
      createGoldenUser({
        weightKgOnDay: () => 100,
        intakeKcal: 3000,
        dayLogsNotComplete: true,
        startDate: day(13),
        startMuKcal: 3000,
        startVarKcal2: 90000,
      }),
    ),
  );
  return decoysPromise;
}

beforeAll(async () => {
  await requireServedFunction(inject("stack"), "run-checkin");
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("run-checkin, due mode", () => {
  describe("a user with three check-ins due", () => {
    let user: TestUser;
    let firstCall: Awaited<ReturnType<typeof runDue>>;

    beforeAll(async () => {
      user = await createGoldenUser();
      await getDecoys();
      firstCall = await runDue(user);
    });

    it("should run all three in one call and answer the count and the next date", () => {
      expect(firstCall.status).toBe(200);
      expect(runCheckinResponseSchema.parse(firstCall.body)).toEqual({
        ran: 3,
        nextCheckinDate: day(35),
      });
    });

    it("should write the golden snapshots on days 14, 21 and 28", async () => {
      expectGoldenChain(await readCheckinSnapshots(user));
    });

    it("should leave the day 28 targets of 2140 kcal, P 126, F 73, C 245 as the one current row", async () => {
      const targets = await readTargets(user);
      const current = targets.filter(({ effective_to }) => effective_to === null);

      expect(current).toHaveLength(1);
      expect(current[0]).toMatchObject({
        effective_from: day(28),
        calories_kcal: 2140,
        protein_g: 126,
        fat_g: 73,
        carbs_g: 245,
        engine_version: ENGINE_VERSION,
      });
    });

    it("should close each target at the next check-in, and give every check-in row its params", async () => {
      const targets = await readTargets(user);

      expect(targets.map(({ effective_from }) => effective_from)).toEqual([
        day(0),
        day(14),
        day(21),
        day(28),
      ]);
      expect(targets.map(({ effective_to }) => effective_to)).toEqual([
        day(14),
        day(21),
        day(28),
        null,
      ]);
      targets.slice(1).forEach(({ params }) => {
        expect(params).toHaveProperty("version", ENGINE_VERSION);
      });
    });

    it("should move the program's next check-in to day 35", async () => {
      expect(await readNextCheckinDate(user)).toBe(day(35));
    });

    it("should answer ran 0 to a second call and leave three snapshots and one current target", async () => {
      const secondCall = await runDue(user);

      expect(secondCall.status).toBe(200);
      expect(runCheckinResponseSchema.parse(secondCall.body)).toEqual({
        ran: 0,
        nextCheckinDate: day(35),
      });
      expect(await readCheckinSnapshots(user)).toHaveLength(3);
      expect(
        (await readTargets(user)).filter(({ effective_to }) => effective_to === null),
      ).toHaveLength(1);
    });
  });

  describe("two calls at once", () => {
    it("should end with the same rows as one call, whichever call recorded each date", async () => {
      const user = await createGoldenUser();

      const calls = await Promise.all([runDue(user), runDue(user)]);

      expect(calls.map(({ status }) => status)).toEqual([200, 200]);
      const ranTotal = calls.reduce(
        (total, { body }) => total + runCheckinResponseSchema.parse(body).ran,
        0,
      );
      expect(ranTotal).toBe(3);
      expectGoldenChain(await readCheckinSnapshots(user));
      const targets = await readTargets(user);
      expect(targets).toHaveLength(4);
      expect(targets.filter(({ effective_to }) => effective_to === null)).toHaveLength(1);
      expect(await readNextCheckinDate(user)).toBe(day(35));
    });
  });

  describe("the user filter", () => {
    it("should not read or change another user's rows", async () => {
      const decoys = await getDecoys();
      const user = await createGoldenUser();

      await runDue(user);

      expectGoldenChain(await readCheckinSnapshots(user));
      for (const decoy of decoys) {
        expect(await readCheckinSnapshots(decoy)).toHaveLength(0);
        expect(await readNextCheckinDate(decoy)).toBe(day(14));
      }
    });
  });

  describe("a user who resumed after the day 14 check-in was recorded", () => {
    it("should run days 21 and 28 from the stored day 14 snapshot", async () => {
      const user = await createGoldenUser({ day14AlreadyRecorded: true });

      const response = await runDue(user);

      expect(runCheckinResponseSchema.parse(response.body)).toEqual({
        ran: 2,
        nextCheckinDate: day(35),
      });
      expectGoldenChain(await readCheckinSnapshots(user));
      const current = (await readTargets(user)).filter(({ effective_to }) => effective_to === null);
      expect(current).toHaveLength(1);
      expect(current[0]).toMatchObject({ effective_from: day(28), calories_kcal: 2140 });
    });
  });

  describe("a user with a soft-deleted weigh-in", () => {
    it("should still get the golden check-ins, because a deleted reading is not read", async () => {
      const user = await createGoldenUser({ softDeletedOutlier: true });

      const response = await runDue(user);

      expect(runCheckinResponseSchema.parse(response.body).ran).toBe(3);
      expectGoldenChain(await readCheckinSnapshots(user));
    });
  });

  describe("a start snapshot dated after the check-in that is due", () => {
    it("should run the golden chain from the snapshot before the date, not from the later start", async () => {
      const user = await createGoldenUser();
      const program = await adminClient()
        .from("programs")
        .select("id")
        .eq("user_id", user.id)
        .single();
      expectNoError(program.error, "the program read");
      // A second start snapshot of 3000 / 90 000 on day 20. A prior read as the newest snapshot of all
      // would start the day 14 check-in from it, and every golden figure would move.
      const lateStart = await adminClient().rpc("record_targets", {
        p_user_id: user.id,
        p_targets: startTargets(program.data?.id ?? ""),
        p_start_snapshot: {
          program_id: program.data?.id ?? "",
          as_of_date: day(20),
          mu_kcal: 3000,
          var_kcal2: 90000,
          measurement: null,
          trend_weight_kg: null,
          engine_version: ENGINE_VERSION,
          params: {},
        },
        p_next_checkin_date: day(14),
        p_checkin_weekday: checkinWeekday(day0),
      });
      expectNoError(lateStart.error, "the late start snapshot");

      const response = await runDue(user);

      expect(runCheckinResponseSchema.parse(response.body).ran).toBe(3);
      expectGoldenChain(await readCheckinSnapshots(user));
    });
  });

  describe("a user with nothing due", () => {
    it("should answer ran 0 and the stored next date, and write nothing", async () => {
      const user = await createGoldenUser({ nextCheckinDate: addCalendarDays(today, 3) });

      const response = await runDue(user);

      expect(response.status).toBe(200);
      expect(runCheckinResponseSchema.parse(response.body)).toEqual({
        ran: 0,
        nextCheckinDate: addCalendarDays(today, 3),
      });
      expect(await readCheckinSnapshots(user)).toHaveLength(0);
    });
  });

  describe("a refused call", () => {
    it("should answer 401 with the typed error and no JWT", async () => {
      const response = await callFunction("run-checkin", { body: { mode: "due" } });

      expect(response.status).toBe(401);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("unauthorized");
    });

    it("should answer 401, not 400, for a mode it does not have and no JWT", async () => {
      const response = await callFunction("run-checkin", { body: { mode: "weekly" } });

      expect(response.status).toBe(401);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("unauthorized");
    });

    it("should answer 409 no_program for a user with no program", async () => {
      const user = await createGoldenUser({ withoutProgram: true });

      const response = await runDue(user);

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ error: { code: "no_program" } });
    });

    it("should answer 409 no_program when the only program has ended, however old its date", async () => {
      const user = await createUserWithEndedProgram();

      const response = await runDue(user);

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ error: { code: "no_program" } });
    });

    it("should answer 409 missing_stats and write nothing for a due user with no birth date", async () => {
      const user = await createGoldenUser({ birthDate: null });

      const response = await runDue(user);

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ error: { code: "missing_stats" } });
      expect(JSON.stringify(response.body)).not.toMatch(/[0-9]/);
      expect(await readCheckinSnapshots(user)).toHaveLength(0);
      expect(await readNextCheckinDate(user)).toBe(day(14));
    });

    it("should answer 400 bad_mode for a mode the function does not have", async () => {
      const user = await createGoldenUser({ withoutProgram: true });

      const response = await callFunction("run-checkin", {
        accessToken: user.accessToken,
        body: { mode: "weekly" },
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ error: { code: "bad_mode" } });
    });

    it.each(["due", "recompute"])(
      "should not accept the backstop secret in the %s mode",
      async (mode) => {
        const response = await callBackstopFunction({
          mode,
          secret: requireFunctionEnvironmentValue("CHECKIN_CRON_SECRET"),
        });

        expect(response.status).toBe(401);
        expect(edgeErrorSchema.parse(response.body).error.code).toBe("unauthorized");
      },
    );
  });
});

// The users of the recompute mode are built here, apart from the golden ones: a profile with its stats,
// and a program the way the wizard leaves it, with no next check-in date. Male, 180 cm, 80 kg and 35 years
// old. At the activity "light" the starting estimate is Mifflin-St Jeor 1755 times 1.375, which is
// 2413.125 with a variance of 131021.376, and at "moderate" it is 1755 times 1.55, which is 2720.25.
// With no weigh-ins the trend weight stands at the onboarding 80 kg, so a lose program at 0.5 % a week
// takes 440 kcal off: 1970 kcal from the light estimate (P 128, F 65, C 218) and 2280 from the moderate.

type RecomputeUserOptions = {
  /** Leaves the profile without a birth date. */
  birthDate?: null;
  /** Replaces "light". */
  activity?: "light" | "moderate";
  /** Replaces the wizard's null date. */
  nextCheckinDate?: string;
  /** Replaces today. */
  startedOn?: string;
};

async function createRecomputeUser(options: RecomputeUserOptions = {}) {
  const user = await createTestUser("key613");
  const profile = await user.client
    .from("profiles")
    .update({
      sex: "male",
      birth_date: options.birthDate === undefined ? birthDate : options.birthDate,
      height_cm: 180,
      activity: options.activity ?? "light",
      onboarding_weight_kg: 80,
    })
    .eq("id", user.id);
  expectNoError(profile.error, "the profile update");
  const programId = await insertProgram(user, options.startedOn ?? today, options.nextCheckinDate);
  return { user, programId };
}

async function insertProgram(user: TestUser, startedOn: string, nextCheckinDate?: string) {
  const program = await user.client
    .from("programs")
    .insert({
      goal: "lose",
      rate_pct_per_week: 0.5,
      protein_g_per_kg: 1.6,
      fat_fraction_of_remaining: 0.4,
      split_preset: "balanced",
      started_on: startedOn,
      ...(nextCheckinDate === undefined ? {} : { next_checkin_date: nextCheckinDate }),
    })
    .select("id")
    .single();
  expectNoError(program.error, "the program insert");
  return program.data?.id ?? "";
}

async function updateProfileActivity(user: TestUser, activity: "light" | "moderate") {
  const { error } = await user.client.from("profiles").update({ activity }).eq("id", user.id);
  expectNoError(error, "the activity update");
}

describe("run-checkin, recompute mode", () => {
  describe("a fresh user with a profile and a program and no snapshot", () => {
    let user: TestUser;
    let response: Awaited<ReturnType<typeof runRecompute>>;

    beforeAll(async () => {
      ({ user } = await createRecomputeUser());
      response = await runRecompute(user);
    });

    it("should answer 200 with the id of the new targets row", async () => {
      expect(response.status).toBe(200);
      const { targetsId } = runCheckinRecomputeResponseSchema.parse(response.body);
      const targets = await readTargets(user);
      expect(targets.map(({ id }) => id)).toEqual([targetsId]);
    });

    it("should write one start snapshot as of today from the starting estimate", async () => {
      const snapshots = await readSnapshots(user);

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject({
        kind: "start",
        as_of_date: today,
        trend_weight_kg: null,
        engine_version: ENGINE_VERSION,
      });
      expect(snapshots[0]?.mu_kcal).toBeCloseTo(2413.125, 6);
      expect(snapshots[0]?.var_kcal2).toBeCloseTo(131021.376, 2);
    });

    it("should write one current target from the start snapshot, effective today", async () => {
      const targets = await readTargets(user);
      const snapshots = await readSnapshots(user);

      expect(targets).toHaveLength(1);
      expect(targets[0]).toMatchObject({
        effective_from: today,
        effective_to: null,
        calories_kcal: 1970,
        protein_g: 128,
        fat_g: 65,
        carbs_g: 218,
        expenditure_snapshot_id: snapshots[0]?.id,
        engine_version: ENGINE_VERSION,
      });
      expect(targets[0]?.basis).toMatchObject({ source: "start", trendWeightKg: 80 });
    });

    it("should set the first check-in 14 days out and the weekday of today", async () => {
      expect(await readNextCheckinDate(user)).toBe(addCalendarDays(today, 14));
      expect(await readCheckinWeekday(user)).toBe(checkinWeekday(today));
    });
  });

  describe("the same call again the same day after the activity changed", () => {
    it("should rewrite the one start snapshot, replace the current target and keep the schedule", async () => {
      const { user } = await createRecomputeUser();
      const first = await runRecompute(user);
      const snapshotsBefore = await readSnapshots(user);
      await updateProfileActivity(user, "moderate");

      const second = await runRecompute(user);

      expect(second.status).toBe(200);
      const snapshots = await readSnapshots(user);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]?.id).toBe(snapshotsBefore[0]?.id);
      expect(snapshots[0]).toMatchObject({ kind: "start", as_of_date: today });
      expect(snapshots[0]?.mu_kcal).toBeCloseTo(2720.25, 6);
      const targets = await readTargets(user);
      expect(targets).toHaveLength(2);
      expect(targets[0]).toMatchObject({ effective_from: today, effective_to: today });
      expect(targets[1]).toMatchObject({
        effective_from: today,
        effective_to: null,
        calories_kcal: 2280,
        expenditure_snapshot_id: snapshots[0]?.id,
      });
      expect(runCheckinRecomputeResponseSchema.parse(second.body).targetsId).toBe(targets[1]?.id);
      expect(runCheckinRecomputeResponseSchema.parse(first.body).targetsId).toBe(targets[0]?.id);
      expect(await readNextCheckinDate(user)).toBe(addCalendarDays(today, 14));
    });
  });

  describe("a user still settling, with a start snapshot from 10 days ago", () => {
    it("should rewrite it on its own date, not today, and leave the schedule", async () => {
      const { user, programId } = await createRecomputeUser({
        startedOn: addCalendarDays(today, -10),
        nextCheckinDate: addCalendarDays(today, 4),
      });
      const start = await adminClient().rpc("record_targets", {
        p_user_id: user.id,
        p_targets: startTargets(programId, addCalendarDays(today, -10)),
        p_start_snapshot: {
          program_id: programId,
          as_of_date: addCalendarDays(today, -10),
          mu_kcal: 2413.125,
          var_kcal2: 131021.376,
          measurement: null,
          trend_weight_kg: null,
          engine_version: ENGINE_VERSION,
          params: {},
        },
        p_next_checkin_date: addCalendarDays(today, 4),
        p_checkin_weekday: checkinWeekday(addCalendarDays(today, -10)),
      });
      expectNoError(start.error, "the start snapshot");
      await updateProfileActivity(user, "moderate");

      const response = await runRecompute(user);

      expect(response.status).toBe(200);
      const snapshots = await readSnapshots(user);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject({
        kind: "start",
        as_of_date: addCalendarDays(today, -10),
      });
      expect(snapshots[0]?.mu_kcal).toBeCloseTo(2720.25, 6);
      const current = (await readTargets(user)).filter(({ effective_to }) => effective_to === null);
      expect(current).toHaveLength(1);
      expect(current[0]).toMatchObject({ effective_from: today, calories_kcal: 2280 });
      expect(await readNextCheckinDate(user)).toBe(addCalendarDays(today, 4));
    });
  });

  describe("a user after the golden catch-up who changes the program's goal to maintain", () => {
    it("should write no snapshot and new targets of 2580 kcal from today, and keep the schedule", async () => {
      const user = await createGoldenUser();
      await runDue(user);
      const snapshotsBefore = await readSnapshots(user);
      const changed = await user.client
        .from("programs")
        .update({ goal: "maintain", rate_pct_per_week: 0 })
        .is("ended_on", null);
      expectNoError(changed.error, "the goal change");

      const response = await runRecompute(user);

      expect(response.status).toBe(200);
      const snapshots = await readSnapshots(user);
      expect(snapshots).toHaveLength(4);
      expect(snapshots.map(({ id }) => id)).toEqual(snapshotsBefore.map(({ id }) => id));
      const targets = await readTargets(user);
      const current = targets.filter(({ effective_to }) => effective_to === null);
      expect(current).toHaveLength(1);
      expect(current[0]).toMatchObject({
        effective_from: today,
        calories_kcal: 2580,
        protein_g: 126,
        expenditure_snapshot_id: snapshots.at(-1)?.id,
      });
      expect(current[0]?.basis).toMatchObject({ source: "recompute", goal: "maintain" });
      expect(targets.at(-2)).toMatchObject({ effective_to: today });
      expect(await readNextCheckinDate(user)).toBe(day(35));
    });
  });

  describe("a returning user whose last program ended and who has a new one from the wizard", () => {
    it("should keep the learned expenditure, write no snapshot and set the schedule", async () => {
      const { user, programId: endedProgramId } = await createRecomputeUser({
        startedOn: addCalendarDays(today, -30),
      });
      const checkin = await adminClient().rpc("record_checkin", {
        p_user_id: user.id,
        p_snapshot: {
          program_id: endedProgramId,
          as_of_date: addCalendarDays(today, -10),
          mu_kcal: 2600,
          var_kcal2: 50000,
          measurement: { eligible: false },
          trend_weight_kg: null,
          engine_version: ENGINE_VERSION,
          params: { version: ENGINE_VERSION },
        },
        p_targets: startTargets(endedProgramId),
        p_next_checkin_date: addCalendarDays(today, -3),
      });
      expectNoError(checkin.error, "the check-in");
      const ended = await user.client
        .from("programs")
        .update({ ended_on: addCalendarDays(today, -5) })
        .eq("id", endedProgramId);
      expectNoError(ended.error, "the program end");
      await insertProgram(user, today);

      const response = await runRecompute(user);

      expect(response.status).toBe(200);
      const snapshots = await readSnapshots(user);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject({
        kind: "checkin",
        as_of_date: addCalendarDays(today, -10),
      });
      const current = (await readTargets(user)).filter(({ effective_to }) => effective_to === null);
      expect(current).toHaveLength(1);
      expect(current[0]).toMatchObject({
        effective_from: today,
        calories_kcal: 2160,
        expenditure_snapshot_id: snapshots[0]?.id,
      });
      expect(current[0]?.basis).toMatchObject({ source: "recompute", tdeeKcal: 2600 });
      const { data, error } = await adminClient()
        .from("programs")
        .select("next_checkin_date")
        .eq("user_id", user.id)
        .is("ended_on", null)
        .single();
      expectNoError(error, "the program read");
      expect(data?.next_checkin_date).toBe(addCalendarDays(today, 14));
      expect(await readCheckinWeekday(user)).toBe(checkinWeekday(today));
    });
  });

  describe("a user whose newest snapshot is 35 days old and whose check-in date is overdue", () => {
    it("should write a start snapshot as of today and move the date to 14 days out, so a due call has nothing to run", async () => {
      const { user, programId } = await createRecomputeUser({
        startedOn: addCalendarDays(today, -60),
      });
      const checkin = await adminClient().rpc("record_checkin", {
        p_user_id: user.id,
        p_snapshot: {
          program_id: programId,
          as_of_date: addCalendarDays(today, -35),
          mu_kcal: 2600,
          var_kcal2: 50000,
          measurement: { eligible: false },
          trend_weight_kg: null,
          engine_version: ENGINE_VERSION,
          params: { version: ENGINE_VERSION },
        },
        p_targets: startTargets(programId),
        p_next_checkin_date: addCalendarDays(today, -28),
      });
      expectNoError(checkin.error, "the check-in");

      const response = await runRecompute(user);

      expect(response.status).toBe(200);
      const snapshots = await readSnapshots(user);
      expect(snapshots.map(({ kind, as_of_date }) => ({ kind, as_of_date }))).toEqual([
        { kind: "checkin", as_of_date: addCalendarDays(today, -35) },
        { kind: "start", as_of_date: today },
      ]);
      expect(await readNextCheckinDate(user)).toBe(addCalendarDays(today, 14));
      expect(await readCheckinWeekday(user)).toBe(checkinWeekday(today));

      const due = await runDue(user);

      expect(runCheckinResponseSchema.parse(due.body)).toEqual({
        ran: 0,
        nextCheckinDate: addCalendarDays(today, 14),
      });
      expect(await readSnapshots(user)).toHaveLength(2);
    });
  });

  describe("a refused call", () => {
    it("should answer 401 with the typed error and no JWT", async () => {
      const response = await callFunction("run-checkin", { body: { mode: "recompute" } });

      expect(response.status).toBe(401);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("unauthorized");
    });

    it("should answer 409 no_program for a user with no program", async () => {
      const user = await createTestUser("key613");

      const response = await runRecompute(user);

      expect(response.status).toBe(409);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("no_program");
    });

    it("should answer 409 no_program when the only program has ended", async () => {
      const user = await createUserWithEndedProgram();

      const response = await runRecompute(user);

      expect(response.status).toBe(409);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("no_program");
    });

    it("should answer 409 missing_stats and write nothing for a user with no birth date", async () => {
      const { user } = await createRecomputeUser({ birthDate: null });

      const response = await runRecompute(user);

      expect(response.status).toBe(409);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("missing_stats");
      expect(JSON.stringify(response.body)).not.toMatch(/[0-9]/);
      expect(await readSnapshots(user)).toHaveLength(0);
      expect(await readTargets(user)).toHaveLength(0);
      expect(await readNextCheckinDate(user)).toBeNull();
      expect(await readCheckinWeekday(user)).toBeNull();
    });
  });
});

// The backstop calls the function with the secret header. `callFunction` sends a bearer token only,
// so this one builds its own request, and can send a secret, a JWT, both or neither.
async function callBackstopFunction(options: {
  mode?: string;
  secret?: string;
  accessToken?: string;
}) {
  const { apiUrl, anonKey } = inject("stack");
  const response = await fetch(`${apiUrl}/functions/v1/run-checkin`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
      ...(options.secret === undefined ? {} : { "x-checkin-secret": options.secret }),
      ...(options.accessToken === undefined
        ? {}
        : { Authorization: `Bearer ${options.accessToken}` }),
    },
    body: JSON.stringify({ mode: options.mode ?? "backstop" }),
    // One run visits every due user in the database, so it can take longer than a single user's call.
    signal: AbortSignal.timeout(60_000),
  });
  const body: unknown = await response.json();
  return { status: response.status, body };
}

const backstopSecret = () => requireFunctionEnvironmentValue("CHECKIN_CRON_SECRET");

// The backstop visits every due user of the database, so other suites' users may be run too. Each
// assertion below is about this suite's own users, and the counts are lower bounds, never totals.
// A run handles the oldest 200 due users first and these users are due since day 14, so they come
// early in any run a real stack makes.
describe("run-checkin, backstop mode", () => {
  describe("a refused call", () => {
    let dueUser: TestUser;
    const responses = new Map<string, Awaited<ReturnType<typeof callBackstopFunction>>>();

    beforeAll(async () => {
      dueUser = await createGoldenUser();
      const wrongSecret = `${backstopSecret()}-wrong`;
      const calls = {
        "a wrong secret": { secret: wrongSecret },
        "no header": {},
        "an empty header": { secret: "" },
        "a user JWT and no secret": { accessToken: dueUser.accessToken },
        "a user JWT and a wrong secret": { secret: wrongSecret, accessToken: dueUser.accessToken },
      };
      for (const [name, options] of Object.entries(calls)) {
        responses.set(name, await callBackstopFunction(options));
      }
    }, 120_000);

    it.each([
      "a wrong secret",
      "no header",
      "an empty header",
      "a user JWT and no secret",
      "a user JWT and a wrong secret",
    ])("should answer 401 unauthorized for %s", (name) => {
      const response = responses.get(name);

      expect(response?.status).toBe(401);
      expect(edgeErrorSchema.parse(response?.body).error.code).toBe("unauthorized");
    });

    it("should give every refusal the same body, so it hints at nothing", () => {
      const bodies = [...responses.values()].map(({ body }) => JSON.stringify(body));

      expect(new Set(bodies).size).toBe(1);
    });

    it("should run nothing for a due user", async () => {
      expect(await readCheckinSnapshots(dueUser)).toHaveLength(0);
      expect(await readNextCheckinDate(dueUser)).toBe(day(14));
    });
  });

  describe("two due users, one not due and one due with a stat missing", () => {
    let dueUsers: TestUser[];
    let notDue: TestUser;
    let missingStats: TestUser;
    let firstCall: Awaited<ReturnType<typeof callBackstopFunction>>;
    let snapshotIdsAfterFirstCall: string[][];
    let secondCall: Awaited<ReturnType<typeof callBackstopFunction>>;

    beforeAll(async () => {
      dueUsers = await Promise.all([createGoldenUser(), createGoldenUser()]);
      notDue = await createGoldenUser({ nextCheckinDate: addCalendarDays(today, 3) });
      missingStats = await createGoldenUser({ birthDate: null });
      firstCall = await callBackstopFunction({ secret: backstopSecret() });
      snapshotIdsAfterFirstCall = await Promise.all(
        dueUsers.map(async (user) => (await readCheckinSnapshots(user)).map(({ id }) => id)),
      );
      secondCall = await callBackstopFunction({ secret: backstopSecret() });
    }, 120_000);

    it("should answer 200 with the counts of users, check-ins run and users that failed", () => {
      expect(firstCall.status).toBe(200);
      const counts = runCheckinBackstopResponseSchema.parse(firstCall.body);

      // Three of this suite's users are due, and each of the two golden ones owes three check-ins.
      expect(counts.users).toBeGreaterThanOrEqual(3);
      expect(counts.ran).toBeGreaterThanOrEqual(6);
      expect(counts.failed).toBeGreaterThanOrEqual(1);
    });

    it("should write the golden snapshots for both due users", async () => {
      for (const user of dueUsers) {
        expectGoldenChain(await readCheckinSnapshots(user));
        expect(await readNextCheckinDate(user)).toBe(day(35));
      }
    });

    it("should leave the user who is not due untouched", async () => {
      expect(await readCheckinSnapshots(notDue)).toHaveLength(0);
      expect(await readNextCheckinDate(notDue)).toBe(addCalendarDays(today, 3));
      expect(await readTargets(notDue)).toHaveLength(1);
    });

    it("should write nothing for the user with a stat missing, and still run the others", async () => {
      expect(await readCheckinSnapshots(missingStats)).toHaveLength(0);
      expect(await readNextCheckinDate(missingStats)).toBe(day(14));
    });

    it("should run nothing new for the due users on a second call", async () => {
      expect(secondCall.status).toBe(200);
      runCheckinBackstopResponseSchema.parse(secondCall.body);

      const snapshotIdsAfterSecondCall = await Promise.all(
        dueUsers.map(async (user) => (await readCheckinSnapshots(user)).map(({ id }) => id)),
      );
      expect(snapshotIdsAfterSecondCall).toEqual(snapshotIdsAfterFirstCall);
      for (const user of dueUsers) {
        expect(await readNextCheckinDate(user)).toBe(day(35));
        expect(await readTargets(user)).toHaveLength(4);
      }
    });
  });
});
