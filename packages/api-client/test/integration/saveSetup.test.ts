import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { requireServedFunction } from "../../../db/test/integration/support/functionsLane";
import { getMySetupState, saveMySetup } from "../../src/repos/setup";
import { getMyTargets } from "../../src/repos/targets";
import { listWeighIns } from "../../src/repos/weighIns";

import type { TestUser } from "./support/users";
import type { SaveSetupOptions, SetupSave } from "../../src/repos/setup";

const profileWithoutUnit: SetupSave["profile"] = {
  sex: "female",
  birth_date: "1987-03-09",
  height_cm: 168.5,
  activity: "moderate",
  onboarding_weight_kg: 74.3,
  target_kcal: 2150,
  target_protein_g: 149,
  target_carbs_g: 230,
  target_fat_g: 58,
};

const firstSave: SetupSave = {
  profile: { ...profileWithoutUnit, weight_unit: "lb" },
  program: {
    goal: "lose",
    rate_pct_per_week: 0.5,
    protein_g_per_kg: 2,
    fat_fraction_of_remaining: 0.3,
    split_preset: "balanced",
    started_on: "2026-10-01",
  },
  weighIn: { weightKg: 74.3, localDate: "2026-10-01" },
};

/** A profile's time zone is UTC unless it is changed, so this is the date `run-checkin` works from. */
const today = toLocalDate(new Date(), "UTC");

async function readSnapshots(user: TestUser) {
  const { data, error } = await user.client
    .from("expenditure_snapshots")
    .select("id,kind,program_id")
    .order("as_of_date", { ascending: true });
  expect(error).toBeNull();
  return data ?? [];
}

async function readCurrentTargets(user: TestUser) {
  const { data, error } = await user.client
    .from("targets")
    .select("id,program_id,basis,calories_kcal")
    .is("effective_to", null);
  expect(error).toBeNull();
  return data ?? [];
}

async function readManualTargets(user: TestUser) {
  const { data, error } = await user.client
    .from("profiles")
    .select("target_kcal,target_protein_g,target_carbs_g,target_fat_g,targets_updated_at")
    .eq("id", user.id)
    .single();
  expect(error).toBeNull();
  return data;
}

const options: SaveSetupOptions = { latestWeighInKg: null, timeZone: "Europe/London" };

describe("saving the setup against the local stack with a real user JWT", () => {
  let user: TestUser;

  beforeAll(async () => {
    await requireServedFunction(inject("stack"), "run-checkin");
    user = await createTestUser("key602");
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should save a full setup and then read it back as set up, with the program and the engine's first targets", async () => {
    const result = await saveMySetup(user.client, user.id, firstSave, options);

    expect(result).toEqual({ targetsPending: false });

    const state = await getMySetupState(user.client);
    expect(state.isSetUp).toBe(true);
    expect(state.stats).toEqual({
      sex: "female",
      birthDate: "1987-03-09",
      heightCm: 168.5,
      activity: "moderate",
      weightUnit: "lb",
    });
    expect(state.program).toMatchObject({
      goal: "lose",
      ratePctPerWeek: 0.5,
      proteinGPerKg: 2,
      fatFraction: 0.3,
      splitPreset: "balanced",
    });
    expect(state.latestWeighIn?.weightKg).toBe(74.3);
    expect((await getMyTargets(user.client)).source).toBe("engine");
  });

  it("should leave one start snapshot, one current target of the program and a first check-in 14 days out", async () => {
    const snapshots = await readSnapshots(user);
    const current = await readCurrentTargets(user);
    const state = await getMySetupState(user.client);
    const { data: schedule, error } = await user.client
      .from("programs")
      .select("next_checkin_date")
      .is("ended_on", null)
      .single();

    expect(error).toBeNull();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({ kind: "start" });
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({ program_id: state.program?.id });
    expect(current[0]?.basis).toMatchObject({ source: "start", goal: "lose" });
    expect(current[0]?.calories_kcal).toBeGreaterThan(0);
    expect(schedule?.next_checkin_date).toBe(addCalendarDays(today, 14));
  });

  it("should have written the wizard's manual targets on the profile row, which the recompute leaves alone", async () => {
    const manual = await readManualTargets(user);

    expect(manual).toMatchObject({
      target_kcal: 2150,
      target_protein_g: 149,
      target_carbs_g: 230,
      target_fat_g: 58,
    });
    expect(manual?.targets_updated_at).not.toBeNull();
  });

  it("should update the active program in place on a recalculation, keep started_on and the stored unit, and write no second weigh-in", async () => {
    const before = await getMySetupState(user.client);
    const snapshotsBefore = await readSnapshots(user);
    const targetsBefore = await readCurrentTargets(user);
    const recalculated: SetupSave = {
      profile: { ...profileWithoutUnit, target_kcal: 2300 },
      program: {
        ...firstSave.program,
        goal: "maintain",
        rate_pct_per_week: 0,
        started_on: "2026-10-24",
      },
      weighIn: firstSave.weighIn,
    };

    const result = await saveMySetup(user.client, user.id, recalculated, {
      latestWeighInKg: before.latestWeighIn?.weightKg ?? null,
      timeZone: "Europe/London",
    });

    const after = await getMySetupState(user.client);
    const { data: program, error } = await user.client
      .from("programs")
      .select("started_on")
      .is("ended_on", null)
      .single();
    expect(error).toBeNull();
    expect(program?.started_on).toBe("2026-10-01");
    expect(after.program?.id).toBe(before.program?.id);
    expect(after.program).toMatchObject({ goal: "maintain", ratePctPerWeek: 0 });
    expect(after.stats.weightUnit).toBe("lb");
    expect(result).toEqual({ targetsPending: false });
    expect((await getMyTargets(user.client)).source).toBe("engine");
    // The recompute rewrites the one start snapshot and replaces the current target with a new row.
    expect(await readSnapshots(user)).toEqual(snapshotsBefore);
    const targetsAfter = await readCurrentTargets(user);
    expect(targetsAfter).toHaveLength(1);
    expect(targetsAfter[0]?.id).not.toBe(targetsBefore[0]?.id);
    expect(targetsAfter[0]?.basis).toMatchObject({ goal: "maintain" });
    expect(targetsAfter[0]?.calories_kcal).toBeGreaterThan(0);
    const manualAfter = await readManualTargets(user);
    expect(manualAfter).toMatchObject({
      target_kcal: 2300,
      target_protein_g: 149,
      target_carbs_g: 230,
      target_fat_g: 58,
    });
    expect(manualAfter?.targets_updated_at).not.toBeNull();
    expect(await listWeighIns(user.client)).toHaveLength(1);
  });
});
