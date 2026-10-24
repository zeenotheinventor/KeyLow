import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import {
  getMyProgramSummary,
  listMyExpenditureSnapshots,
  listMyTargetsHistory,
} from "../../src/repos/program";

import type { TestUser } from "./support/users";
import type { Json } from "@keylow/db";

/*
 * The program reads against the local stack with real user JWTs. The tables are select-only for a user,
 * so the rows are written the way `run-checkin` writes them: through `record_targets` and
 * `record_checkin`, called with the service role.
 */

const ENGINE_VERSION = "keylow-engine-v1";

const basis = (source: string): Json => ({
  source,
  tdeeKcal: 2640,
  trendWeightKg: 78.65,
  bmrKcal: 1755,
  goal: "lose",
  ratePctPerWeek: 0.5,
  effectiveRatePctPerWeek: 0.49,
  proteinGPerKg: 1.6,
  fatFraction: 0.3,
  dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
  clamps: [],
});

const measurement = (zKcal: number): Json => ({
  eligible: true,
  zKcal,
  rKcal2: 62467.9,
  slopeKgPerDay: -0.05,
  seSlopeKg: 0.0198898,
  meanIntakeKcal: 2200,
  spanDays: 14,
  weighDays: 14,
  completeDays: 14,
  gain: 0.5,
  rawStepKcal: 312.5,
  stepKcal: 250,
  stepClamped: true,
});

const targetsJson = (
  programId: string,
  calories: number,
  source: string,
  effectiveFrom: string,
): Json => ({
  program_id: programId,
  effective_from: effectiveFrom,
  calories_kcal: calories,
  protein_g: 126,
  fat_g: 73,
  carbs_g: 245,
  dow_calories_kcal: Array.from({ length: 7 }, () => calories),
  basis: basis(source),
  engine_version: ENGINE_VERSION,
  params: {},
});

async function createProgram(user: TestUser): Promise<string> {
  const { data, error } = await user.client
    .from("programs")
    .insert({
      goal: "lose",
      rate_pct_per_week: 0.5,
      protein_g_per_kg: 1.6,
      fat_fraction_of_remaining: 0.3,
      split_preset: "balanced",
      started_on: "2026-10-01",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data?.id ?? "";
}

async function recordStart(user: TestUser, programId: string, muKcal: number): Promise<void> {
  const { error } = await adminClient().rpc("record_targets", {
    p_user_id: user.id,
    p_targets: targetsJson(programId, 2150, "start", "2026-10-01"),
    p_start_snapshot: {
      program_id: programId,
      as_of_date: "2026-10-01",
      mu_kcal: muKcal,
      var_kcal2: 90000,
      measurement: null,
      trend_weight_kg: null,
      engine_version: ENGINE_VERSION,
      params: {},
    },
    p_next_checkin_date: "2026-10-15",
    p_checkin_weekday: 4,
  });
  expect(error).toBeNull();
}

async function recordCheckin(
  user: TestUser,
  programId: string,
  asOfDate: string,
  muKcal: number,
  calories: number,
): Promise<void> {
  const { data, error } = await adminClient().rpc("record_checkin", {
    p_user_id: user.id,
    p_snapshot: {
      program_id: programId,
      as_of_date: asOfDate,
      mu_kcal: muKcal,
      var_kcal2: 40000,
      measurement: measurement(2585),
      trend_weight_kg: 78.65,
      engine_version: ENGINE_VERSION,
      params: {},
    },
    p_targets: targetsJson(programId, calories, "checkin", asOfDate),
    p_next_checkin_date: "2026-11-06",
  });
  expect(error).toBeNull();
  expect(data).toBe("recorded");
}

describe("reading the program against the local stack with real user JWTs", () => {
  let measuredUser: TestUser;
  let otherUser: TestUser;
  let noProgramUser: TestUser;
  let endedUser: TestUser;
  let measuredProgramId: string;

  beforeAll(async () => {
    [measuredUser, otherUser, noProgramUser, endedUser] = await Promise.all([
      createTestUser("key620"),
      createTestUser("key620"),
      createTestUser("key620"),
      createTestUser("key620"),
    ]);

    measuredProgramId = await createProgram(measuredUser);
    await recordStart(measuredUser, measuredProgramId, 2200);
    await recordCheckin(measuredUser, measuredProgramId, "2026-10-15", 2230, 2170);
    await recordCheckin(measuredUser, measuredProgramId, "2026-10-22", 2260, 2140);

    const otherProgramId = await createProgram(otherUser);
    await recordStart(otherUser, otherProgramId, 3100);

    const endedProgramId = await createProgram(endedUser);
    await recordStart(endedUser, endedProgramId, 2400);
    const { error } = await endedUser.client
      .from("programs")
      .update({ ended_on: "2026-10-05" })
      .eq("id", endedProgramId);
    expect(error).toBeNull();
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  describe("the summary", () => {
    it("should read the program, the newest two snapshots and the current and previous targets back", async () => {
      const summary = await getMyProgramSummary(measuredUser.client);

      expect(summary.program).toEqual({
        id: measuredProgramId,
        goal: "lose",
        ratePctPerWeek: 0.5,
        proteinGPerKg: 1.6,
        fatFraction: 0.3,
        splitPreset: "balanced",
        startedOn: "2026-10-01",
        nextCheckinDate: "2026-11-06",
      });
      expect(summary.latestSnapshot).toMatchObject({
        kind: "checkin",
        asOfDate: "2026-10-22",
        muKcal: 2260,
        varKcal2: 40000,
        measurement: measurement(2585),
      });
      expect(summary.previousSnapshot).toMatchObject({
        kind: "checkin",
        asOfDate: "2026-10-15",
        muKcal: 2230,
      });
      expect(summary.currentTargets).toMatchObject({
        effectiveFrom: "2026-10-22",
        effectiveTo: null,
        isCurrent: true,
        caloriesKcal: 2140,
        proteinG: 126,
        fatG: 73,
        carbsG: 245,
        dowCaloriesKcal: [2140, 2140, 2140, 2140, 2140, 2140, 2140],
        basis: basis("checkin"),
      });
      expect(summary.previousTargets).toMatchObject({
        effectiveFrom: "2026-10-15",
        effectiveTo: "2026-10-22",
        isCurrent: false,
        caloriesKcal: 2170,
      });
    });

    it("should read a program that has only its start snapshot as settling, with nothing before it", async () => {
      const summary = await getMyProgramSummary(otherUser.client);

      expect(summary.latestSnapshot).toMatchObject({
        kind: "start",
        muKcal: 3100,
        measurement: null,
      });
      expect(summary.previousSnapshot).toBeNull();
      expect(summary.previousTargets).toBeNull();
    });

    it("should read nothing for an account with no program, and for one whose program has ended", async () => {
      for (const user of [noProgramUser, endedUser]) {
        expect(await getMyProgramSummary(user.client)).toEqual({
          program: null,
          latestSnapshot: null,
          previousSnapshot: null,
          currentTargets: null,
          previousTargets: null,
        });
      }
    });
  });

  describe("the expenditure history", () => {
    it("should read the snapshots from the date on, oldest first", async () => {
      const snapshots = await listMyExpenditureSnapshots(measuredUser.client, {
        fromDate: "2026-10-10",
      });

      expect(snapshots.map((snapshot) => [snapshot.asOfDate, snapshot.muKcal])).toEqual([
        ["2026-10-15", 2230],
        ["2026-10-22", 2260],
      ]);
    });

    it("should read the start snapshot with no measurement and the check-ins with theirs", async () => {
      const snapshots = await listMyExpenditureSnapshots(measuredUser.client, {
        fromDate: "2026-10-01",
      });

      expect(snapshots.map((snapshot) => snapshot.kind)).toEqual(["start", "checkin", "checkin"]);
      expect(snapshots.map((snapshot) => snapshot.measurement === null)).toEqual([
        true,
        false,
        false,
      ]);
    });
  });

  describe("the targets history", () => {
    it("should read the rows that touch the date, oldest first, and leave out one that ended on it", async () => {
      const onTheEnd = await listMyTargetsHistory(measuredUser.client, { fromDate: "2026-10-15" });
      const dayBefore = await listMyTargetsHistory(measuredUser.client, { fromDate: "2026-10-14" });

      expect(onTheEnd.map((row) => row.effectiveFrom)).toEqual(["2026-10-15", "2026-10-22"]);
      expect(dayBefore.map((row) => row.effectiveFrom)).toEqual([
        "2026-10-01",
        "2026-10-15",
        "2026-10-22",
      ]);
    });

    it("should mark only the open row of an active program current", async () => {
      const history = await listMyTargetsHistory(measuredUser.client, { fromDate: "2026-10-01" });

      expect(history.map((row) => row.isCurrent)).toEqual([false, false, true]);
    });

    it("should not mark the open row of an ended program current", async () => {
      const history = await listMyTargetsHistory(endedUser.client, { fromDate: "2026-10-01" });

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ effectiveTo: null, isCurrent: false });
    });
  });

  it("should not show one account another's snapshots or targets", async () => {
    const fromDate = "2026-09-01";

    expect(await listMyExpenditureSnapshots(noProgramUser.client, { fromDate })).toEqual([]);
    expect(await listMyTargetsHistory(noProgramUser.client, { fromDate })).toEqual([]);
    expect(
      (await listMyExpenditureSnapshots(otherUser.client, { fromDate })).map(
        (snapshot) => snapshot.muKcal,
      ),
    ).toEqual([3100]);
    expect(await listMyTargetsHistory(otherUser.client, { fromDate })).toHaveLength(1);
  });
});
