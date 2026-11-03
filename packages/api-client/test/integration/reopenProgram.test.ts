import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { getMyProgramSummary, reopenProgram } from "../../src/repos/program";
import { getMyTargets, updateMyTargets } from "../../src/repos/targets";

import type { TestUser } from "./support/users";
import type { Json } from "@keylow/db";

/*
 * Reopening a program against the local stack with real user JWTs. A program is made the way the setup
 * makes it, and its current targets row is written the way `run-checkin` writes it, through the service
 * role's `record_targets`. All the data is invented.
 */

const ENGINE_VERSION = "keylow-engine-v1";
const NEXT_CHECKIN_DATE = "2026-11-06";

const targetsJson = (programId: string, calories: number): Json => ({
  program_id: programId,
  effective_from: "2026-10-22",
  calories_kcal: calories,
  protein_g: 126,
  fat_g: 73,
  carbs_g: 245,
  dow_calories_kcal: Array.from({ length: 7 }, () => calories),
  basis: {
    source: "start",
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
  },
  engine_version: ENGINE_VERSION,
  params: {},
});

async function setUpProgram(user: TestUser, calories: number): Promise<string> {
  const { data, error } = await user.client
    .from("programs")
    .insert({
      goal: "lose",
      rate_pct_per_week: 0.5,
      protein_g_per_kg: 1.6,
      fat_fraction_of_remaining: 0.3,
      split_preset: "balanced",
      started_on: "2026-10-22",
      next_checkin_date: NEXT_CHECKIN_DATE,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const programId = data?.id ?? "";
  const written = await adminClient().rpc("record_targets", {
    p_user_id: user.id,
    p_targets: targetsJson(programId, calories),
    p_start_snapshot: {
      program_id: programId,
      as_of_date: "2026-10-22",
      mu_kcal: 2400,
      var_kcal2: 90000,
      measurement: null,
      trend_weight_kg: null,
      engine_version: ENGINE_VERSION,
      params: {},
    },
    p_next_checkin_date: NEXT_CHECKIN_DATE,
    p_checkin_weekday: 4,
  });
  expect(written.error).toBeNull();
  return programId;
}

const targets = { kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 };

describe("reopening a program against the local stack with real user JWTs", () => {
  let owner: TestUser;
  let stranger: TestUser;
  let programId: string;

  beforeAll(async () => {
    owner = await createTestUser("key697own");
    stranger = await createTestUser("key697str");
    programId = await setUpProgram(owner, 2140);
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should put the program back after your own targets ended it, with the same next check-in and the engine's targets", async () => {
    const before = await getMyProgramSummary(owner.client);
    expect(before.program?.id).toBe(programId);

    await updateMyTargets(owner.client, owner.id, targets);
    expect((await getMyProgramSummary(owner.client)).program).toBeNull();
    expect(await getMyTargets(owner.client)).toMatchObject({ source: "manual", kcal: 2000 });

    await expect(reopenProgram(stranger.client, programId)).resolves.toBe(false);
    expect((await getMyProgramSummary(owner.client)).program).toBeNull();

    await expect(reopenProgram(owner.client, programId)).resolves.toBe(true);

    const after = await getMyProgramSummary(owner.client);
    expect(after.program).toEqual(before.program);
    expect(after.program?.nextCheckinDate).toBe(NEXT_CHECKIN_DATE);
    expect(await getMyTargets(owner.client)).toMatchObject({ source: "engine", kcal: 2140 });
  });

  it("should refuse a program that is already active", async () => {
    await expect(reopenProgram(owner.client, programId)).resolves.toBe(false);
  });

  it("should refuse an older program while a newer one exists", async () => {
    const newcomer = await createTestUser("key697new");
    const older = await setUpProgram(newcomer, 2100);
    await updateMyTargets(newcomer.client, newcomer.id, targets);
    const { error } = await newcomer.client.from("programs").insert({
      goal: "maintain",
      rate_pct_per_week: 0,
      protein_g_per_kg: 1.6,
      fat_fraction_of_remaining: 0.3,
      split_preset: "balanced",
      started_on: "2026-11-02",
    });
    expect(error).toBeNull();

    await expect(reopenProgram(newcomer.client, older)).resolves.toBe(false);
  });
});
