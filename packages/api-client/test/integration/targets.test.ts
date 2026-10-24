import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, anonClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { getMyTargets, getMyTimeZone, updateMyTargets } from "../../src/repos/targets";

import type { TestUser } from "./support/users";

const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };
const noTargets = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };
const manual = { source: "manual" };

describe("reading and saving targets against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key203"), createTestUser("key203")]);
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should read every target as null for a user who never set one", async () => {
    expect(await getMyTargets(userA.client)).toEqual({ ...noTargets, ...manual });
  });

  it("should save the targets, return them and read them back", async () => {
    expect(await updateMyTargets(userA.client, userA.id, targets)).toEqual({
      ...targets,
      ...manual,
    });
    expect(await getMyTargets(userA.client)).toEqual({ ...targets, ...manual });
  });

  it("should stamp the time the targets were set", async () => {
    const before = Date.now();

    await updateMyTargets(userA.client, userA.id, targets);

    const { data } = await userA.client.from("profiles").select("targets_updated_at").single();
    expect(Date.parse(data?.targets_updated_at ?? "")).toBeGreaterThanOrEqual(before - 5_000);
  });

  it("should clear a macro the user leaves blank and keep the calories", async () => {
    await updateMyTargets(userA.client, userA.id, {
      kcal: 1800,
      protein_g: null,
      carbs_g: 0,
      fat_g: null,
    });

    expect(await getMyTargets(userA.client)).toEqual({
      kcal: 1800,
      protein_g: null,
      carbs_g: 0,
      fat_g: null,
      ...manual,
    });
  });

  it("should refuse calories outside 800 to 6,000 with the database check as the cause", async () => {
    await expect(
      updateMyTargets(userA.client, userA.id, { ...targets, kcal: 799 }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(
      updateMyTargets(userA.client, userA.id, { ...targets, kcal: 6001 }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("should leave another user's targets unset and unreadable", async () => {
    expect(await getMyTargets(userB.client)).toEqual({ ...noTargets, ...manual });

    const { data } = await userA.client.from("profiles").select("target_kcal").eq("id", userB.id);
    expect(data).toEqual([]);
  });

  it("should not let a user write another user's profile, and leave it as it was", async () => {
    await expect(updateMyTargets(userA.client, userB.id, targets)).rejects.toThrow(
      "Could not save your targets",
    );

    expect(await getMyTargets(userB.client)).toEqual({ ...noTargets, ...manual });
  });

  it("should refuse a caller with no session", async () => {
    await expect(updateMyTargets(anonClient(), userA.id, targets)).rejects.toMatchObject({
      cause: { code: "42501" },
    });
  });

  it("should read the profile's time zone, which is UTC until it is set, and only the caller's", async () => {
    expect(await getMyTimeZone(userA.client)).toBe("UTC");
  });
});

describe("the targets of an active program against the local stack with a real user JWT", () => {
  const engineTargets = {
    kcal: 2140,
    protein_g: 126,
    carbs_g: 245,
    fat_g: 73,
    dowCaloriesKcal: [2200, 2200, 2200, 2200, 2200, 1900, 2100],
    source: "engine",
  };
  let user: TestUser;
  let programId: string;

  beforeAll(async () => {
    user = await createTestUser("key617");
    const { error } = await user.client
      .from("profiles")
      .update({ target_kcal: 2200, target_protein_g: 160, target_carbs_g: 220, target_fat_g: 70 })
      .eq("id", user.id);
    expect(error).toBeNull();

    const { data, error: programError } = await user.client
      .from("programs")
      .insert({
        goal: "lose",
        rate_pct_per_week: 0.5,
        protein_g_per_kg: 1.6,
        fat_fraction_of_remaining: 0.4,
        split_preset: "balanced",
        started_on: "2026-01-01",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(programError).toBeNull();
    programId = data?.id ?? "";
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should read the profile's targets while the program has no targets row yet", async () => {
    expect(await getMyTargets(user.client)).toEqual({ ...targets, ...manual });
  });

  it("should read the current targets row, with its days, once the engine has written one", async () => {
    // Clients cannot insert into targets, so the row goes in through the writer the check-in uses.
    const { error } = await adminClient().rpc("record_targets", {
      p_user_id: user.id,
      p_targets: {
        program_id: programId,
        effective_from: "2026-10-24",
        calories_kcal: 2140,
        protein_g: 126,
        fat_g: 73,
        carbs_g: 245,
        dow_calories_kcal: [2200, 2200, 2200, 2200, 2200, 1900, 2100],
        basis: {},
        engine_version: "test",
        params: {},
      },
      p_start_snapshot: null,
      p_next_checkin_date: "2026-11-07",
      p_checkin_weekday: 6,
    });
    expect(error).toBeNull();

    expect(await getMyTargets(user.client)).toEqual(engineTargets);
  });

  it("should end the program on a manual save and read the profile's figures from then on", async () => {
    const saved = await updateMyTargets(user.client, user.id, {
      kcal: 1900,
      protein_g: 150,
      carbs_g: 180,
      fat_g: 60,
    });

    expect(saved).toEqual({ kcal: 1900, protein_g: 150, carbs_g: 180, fat_g: 60, ...manual });
    const { data: program } = await user.client
      .from("programs")
      .select("ended_on")
      .eq("id", programId)
      .single();
    expect(program?.ended_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await getMyTargets(user.client)).toEqual({
      kcal: 1900,
      protein_g: 150,
      carbs_g: 180,
      fat_g: 60,
      ...manual,
    });
  });

  it("should leave the ended program's last row open and not read it", async () => {
    const { data } = await adminClient()
      .from("targets")
      .select("calories_kcal")
      .eq("user_id", user.id)
      .is("effective_to", null);

    expect(data).toEqual([{ calories_kcal: 2140 }]);
    expect(await getMyTargets(user.client)).toMatchObject({ kcal: 1900, source: "manual" });
  });
});
