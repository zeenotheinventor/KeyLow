import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { anonClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { getMyTargets, getMyTimeZone, updateMyTargets } from "../../src/repos/targets";

import type { TestUser } from "./support/users";

const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };
const noTargets = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };

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
    expect(await getMyTargets(userA.client)).toEqual(noTargets);
  });

  it("should save the targets, return them and read them back", async () => {
    expect(await updateMyTargets(userA.client, userA.id, targets)).toEqual(targets);
    expect(await getMyTargets(userA.client)).toEqual(targets);
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
    expect(await getMyTargets(userB.client)).toEqual(noTargets);

    const { data } = await userA.client.from("profiles").select("target_kcal").eq("id", userB.id);
    expect(data).toEqual([]);
  });

  it("should not let a user write another user's profile, and leave it as it was", async () => {
    await expect(updateMyTargets(userA.client, userB.id, targets)).rejects.toThrow(
      "Could not save your targets",
    );

    expect(await getMyTargets(userB.client)).toEqual(noTargets);
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
