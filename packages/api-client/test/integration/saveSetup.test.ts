import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
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

const options: SaveSetupOptions = { latestWeighInKg: null, timeZone: "Europe/London" };

describe("saving the setup against the local stack with a real user JWT", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser("key602");
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should save a full setup and then read it back as set up, with the program and the targets", async () => {
    await saveMySetup(user.client, user.id, firstSave, options);

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
    expect(await getMyTargets(user.client)).toEqual({
      kcal: 2150,
      protein_g: 149,
      carbs_g: 230,
      fat_g: 58,
      source: "manual",
    });
  });

  it("should update the active program in place on a recalculation, keep started_on and the stored unit, and write no second weigh-in", async () => {
    const before = await getMySetupState(user.client);
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

    await saveMySetup(user.client, user.id, recalculated, {
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
    expect((await getMyTargets(user.client)).kcal).toBe(2300);
    expect(await listWeighIns(user.client)).toHaveLength(1);
  });
});
