import { toLocalDate } from "@keylow/core/dates";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { requireServedFunction } from "../../../db/test/integration/support/functionsLane";
import { updateMyProgram } from "../../src/repos/program";
import { getMySetupState, saveMySetup } from "../../src/repos/setup";
import { getMyTargets } from "../../src/repos/targets";

import type { TestUser } from "./support/users";
import type { ProgramChanges } from "../../src/repos/program";
import type { SetupSave } from "../../src/repos/setup";

/*
 * Editing the program against the local stack with a real user JWT and the served `run-checkin`: a fresh
 * account's full setup save, then an edit to maintain. The expected figures are the rows and not the
 * engine's numbers, which `@keylow/db`'s run-checkin suite holds as literals.
 */

const today = toLocalDate(new Date(), "UTC");

const firstSave: SetupSave = {
  profile: {
    sex: "female",
    birth_date: "1987-03-09",
    height_cm: 168.5,
    activity: "moderate",
    onboarding_weight_kg: 74.3,
    target_kcal: 2150,
    target_protein_g: 149,
    target_carbs_g: 230,
    target_fat_g: 58,
    weight_unit: "kg",
  },
  program: {
    goal: "lose",
    rate_pct_per_week: 0.5,
    protein_g_per_kg: 2,
    fat_fraction_of_remaining: 0.28,
    split_preset: "low_fat",
    started_on: today,
  },
  weighIn: { weightKg: 74.3, localDate: today },
};

const toMaintain: ProgramChanges = {
  goal: "maintain",
  ratePctPerWeek: 0,
  proteinGPerKg: 1.6,
  fatFraction: 0.4,
  splitPreset: "balanced",
};

async function readSnapshotIds(user: TestUser) {
  const { data, error } = await user.client.from("expenditure_snapshots").select("id");
  expect(error).toBeNull();
  return (data ?? []).map(({ id }) => id);
}

async function readCurrentTargets(user: TestUser) {
  const { data, error } = await user.client
    .from("targets")
    .select("id,basis")
    .is("effective_to", null);
  expect(error).toBeNull();
  return data ?? [];
}

describe("editing the program after a setup save, against the local stack", () => {
  let user: TestUser;

  beforeAll(async () => {
    await requireServedFunction(inject("stack"), "run-checkin");
    user = await createTestUser("key621");
    await saveMySetup(user.client, user.id, firstSave, { latestWeighInKg: null, timeZone: "UTC" });
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should write the edit in place, recompute, and give the new current target without a new snapshot", async () => {
    const snapshotsBefore = await readSnapshotIds(user);
    const targetsBefore = await readCurrentTargets(user);
    const programBefore = await getMySetupState(user.client);

    const answer = await updateMyProgram(user.client, user.id, toMaintain, { today });

    const targetsAfter = await readCurrentTargets(user);
    const programAfter = await getMySetupState(user.client);
    expect(snapshotsBefore).toHaveLength(1);
    expect(await readSnapshotIds(user)).toEqual(snapshotsBefore);
    expect(targetsAfter).toHaveLength(1);
    expect(targetsAfter[0]?.id).toBe(answer.targetsId);
    expect(targetsAfter[0]?.id).not.toBe(targetsBefore[0]?.id);
    // No check-in snapshot exists yet, so the newest snapshot is still the start row and the basis says start.
    expect(targetsAfter[0]?.basis).toMatchObject({ source: "start", goal: "maintain" });
    expect(programAfter.program?.id).toBe(programBefore.program?.id);
    expect(programAfter.program).toMatchObject({
      goal: "maintain",
      ratePctPerWeek: 0,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      splitPreset: "balanced",
    });
    expect((await getMyTargets(user.client)).source).toBe("engine");
  });

  it("should refuse a lose goal once the birth date says under 18, before any write", async () => {
    const targetsBefore = await readCurrentTargets(user);
    const { error } = await user.client
      .from("profiles")
      .update({ birth_date: "2015-06-15" })
      .eq("id", user.id);
    expect(error).toBeNull();

    await expect(
      updateMyProgram(
        user.client,
        user.id,
        { ...toMaintain, goal: "lose", ratePctPerWeek: 0.5 },
        { today },
      ),
    ).rejects.toBeInstanceOf(RangeError);

    expect((await getMySetupState(user.client)).program).toMatchObject({ goal: "maintain" });
    expect(await readCurrentTargets(user)).toEqual(targetsBefore);
  });
});
