import { buildManualWeighIn } from "@keylow/core/weight";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { getMySetupState } from "../../src/repos/setup";
import { addWeighIn, softDeleteWeighIn } from "../../src/repos/weighIns";

import type { TestUser } from "./support/users";

const noStats = { sex: null, birthDate: null, heightCm: null, activity: null, weightUnit: null };

const manualWeighIn = (weightKg: number, measuredAt: string) =>
  buildManualWeighIn({
    weightKg,
    measuredAt: new Date(measuredAt),
    note: null,
    timeZone: "Europe/London",
  });

describe("reading the setup state against the local stack with real user JWTs", () => {
  let freshUser: TestUser;
  let setUpUser: TestUser;

  beforeAll(async () => {
    [freshUser, setUpUser] = await Promise.all([
      createTestUser("key601"),
      createTestUser("key601"),
    ]);
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should read a fresh account as not set up, with no stats, no program and no weigh-in", async () => {
    expect(await getMySetupState(freshUser.client)).toEqual({
      isSetUp: false,
      stats: noStats,
      program: null,
      latestWeighIn: null,
    });
  });

  it("should read a set up account with its stats, its active program and its latest weigh-in", async () => {
    const { error: profileError } = await setUpUser.client
      .from("profiles")
      .update({
        sex: "male",
        birth_date: "1988-04-12",
        height_cm: 181.5,
        activity: "light",
        weight_unit: "st",
        onboarding_completed_at: "2026-10-20T09:00:00Z",
      })
      .eq("id", setUpUser.id);
    expect(profileError).toBeNull();

    const { data: ended, error: endedError } = await setUpUser.client
      .from("programs")
      .insert({
        goal: "lose",
        rate_pct_per_week: 1,
        protein_g_per_kg: 1.6,
        fat_fraction_of_remaining: 0.25,
        split_preset: "low_fat",
        started_on: "2026-08-01",
        ended_on: "2026-09-30",
      })
      .select("id")
      .single();
    expect(endedError).toBeNull();

    const { data: active, error: activeError } = await setUpUser.client
      .from("programs")
      .insert({
        goal: "gain",
        rate_pct_per_week: 0.25,
        protein_g_per_kg: 2.2,
        fat_fraction_of_remaining: 0.35,
        split_preset: "low_carb",
        started_on: "2026-10-01",
      })
      .select("id")
      .single();
    expect(activeError).toBeNull();

    await addWeighIn(setUpUser.client, manualWeighIn(90.1, "2026-10-01T07:30:00Z"));
    await addWeighIn(setUpUser.client, manualWeighIn(82.3, "2026-10-16T07:30:00Z"));

    const state = await getMySetupState(setUpUser.client);

    expect(ended?.id).not.toBe(active?.id);
    expect(state).toEqual({
      isSetUp: true,
      stats: {
        sex: "male",
        birthDate: "1988-04-12",
        heightCm: 181.5,
        activity: "light",
        weightUnit: "st",
      },
      program: {
        id: active?.id,
        goal: "gain",
        ratePctPerWeek: 0.25,
        proteinGPerKg: 2.2,
        fatFraction: 0.35,
        splitPreset: "low_carb",
      },
      latestWeighIn: { weightKg: 82.3, localDate: "2026-10-16" },
    });
  });

  it("should skip a soft-deleted weigh-in and read the newest live one", async () => {
    const newest = await addWeighIn(setUpUser.client, manualWeighIn(99.9, "2026-10-22T07:30:00Z"));
    expect((await getMySetupState(setUpUser.client)).latestWeighIn).toEqual({
      weightKg: 99.9,
      localDate: "2026-10-22",
    });

    await softDeleteWeighIn(setUpUser.client, newest.id);

    expect((await getMySetupState(setUpUser.client)).latestWeighIn).toEqual({
      weightKg: 82.3,
      localDate: "2026-10-16",
    });
  });

  it("should not show one account another's program or weigh-in", async () => {
    const state = await getMySetupState(freshUser.client);

    expect(state.program).toBeNull();
    expect(state.latestWeighIn).toBeNull();
  });
});
