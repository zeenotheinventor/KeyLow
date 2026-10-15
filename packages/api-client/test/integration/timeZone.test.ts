import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { anonClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { getMyTimeZone, updateMyTimeZone } from "../../src/repos/targets";

import type { TestUser } from "./support/users";

describe("saving the time zone against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key247"), createTestUser("key247")]);
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should let a user set their own time zone and read it back", async () => {
    await updateMyTimeZone(userA.client, "Europe/London");

    expect(await getMyTimeZone(userA.client)).toBe("Europe/London");
  });

  it("should leave another user's time zone as it was when their id is the target of an update", async () => {
    const { data } = await userA.client
      .from("profiles")
      .update({ timezone: "Asia/Tokyo" })
      .eq("id", userB.id)
      .select("id");

    expect(data).toEqual([]);
    expect(await getMyTimeZone(userB.client)).toBe("UTC");
  });

  it("should change only the caller's row, never the other user's", async () => {
    await updateMyTimeZone(userA.client, "America/New_York");

    expect(await getMyTimeZone(userA.client)).toBe("America/New_York");
    expect(await getMyTimeZone(userB.client)).toBe("UTC");
  });

  it("should refuse a caller with no session", async () => {
    await expect(updateMyTimeZone(anonClient(), "Europe/London")).rejects.toThrow(
      "Could not save your time zone",
    );
  });
});
