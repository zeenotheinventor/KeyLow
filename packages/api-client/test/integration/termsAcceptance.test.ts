import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { anonClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { acceptTerms, getMyTermsAcceptance } from "../../src/repos/terms";

import type { TestUser } from "./support/users";

describe("reading and recording the terms acceptance against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key158"), createTestUser("key158")]);
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should read null for both fields for a user who signed up with no terms metadata", async () => {
    expect(await getMyTermsAcceptance(userA.client)).toEqual({
      terms_accepted_at: null,
      terms_version: null,
    });
  });

  it("should record the version and a database time when the user accepts", async () => {
    const before = Date.now();

    await acceptTerms(userA.client, "2026-10-15");

    const acceptance = await getMyTermsAcceptance(userA.client);
    expect(acceptance?.terms_version).toBe("2026-10-15");
    expect(Date.parse(acceptance?.terms_accepted_at ?? "")).toBeGreaterThanOrEqual(before - 5_000);
  });

  it("should overwrite the version when the user accepts a different one", async () => {
    await acceptTerms(userA.client, "2027-02-01");

    expect((await getMyTermsAcceptance(userA.client))?.terms_version).toBe("2027-02-01");
  });

  it("should leave another user's acceptance untouched", async () => {
    expect(await getMyTermsAcceptance(userB.client)).toEqual({
      terms_accepted_at: null,
      terms_version: null,
    });
  });

  it("should refuse a blank version with the database error 22023 as the cause", async () => {
    await expect(acceptTerms(userB.client, "  ")).rejects.toMatchObject({
      cause: { code: "22023" },
    });
  });

  it("should refuse a caller with no session with the database error 42501 as the cause", async () => {
    await expect(acceptTerms(anonClient(), "2026-10-15")).rejects.toMatchObject({
      cause: { code: "42501" },
    });
  });
});
