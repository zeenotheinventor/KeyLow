import { isAuthApiError } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { adminClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { requireServedFunction } from "../../../db/test/integration/support/functionsLane";
import { AccountDeletionError, deleteMyAccount } from "../../src/repos/deleteAccount";

import type { TestUser } from "./support/users";

/*
 * `deleteMyAccount` against the served `delete-account` function and the local auth service, with real
 * user JWTs. The second case is the one that pins what GoTrue answers for the token of an account that no
 * longer exists, because the function's retry safety rests on it: `user_not_found`, with the session left
 * in the client's storage.
 */

/** Whether the auth service still knows the user. Any answer but the user or "not found" throws. */
async function userExists(id: string): Promise<boolean> {
  const { data, error } = await adminClient().auth.admin.getUserById(id);
  if (error === null) {
    return data.user.id === id;
  }
  if (isAuthApiError(error) && error.code === "user_not_found") {
    return false;
  }
  throw new Error(`Could not look the user up (${error.code ?? "unknown"})`);
}

describe("deleteMyAccount against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    await requireServedFunction(inject("stack"), "delete-account");
    [userA, userB] = await Promise.all([
      createTestUser("deleteAccount"),
      createTestUser("deleteAccount"),
    ]);
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should resolve deleted on the function's answer, and the auth service no longer knows the user", async () => {
    const result = await deleteMyAccount(userA.client);

    expect(result).toEqual({ deleted: true, confirmedBy: "response" });
    expect(await userExists(userA.id)).toBe(false);
  });

  it("should resolve deleted by the check on a second call with the same stale session, and keep the session", async () => {
    const before = (await userA.client.auth.getSession()).data.session?.access_token;

    const result = await deleteMyAccount(userA.client);

    expect(result).toEqual({ deleted: true, confirmedBy: "check" });
    expect((await userA.client.auth.getSession()).data.session?.access_token).toBe(before);
  });

  it("should not confirm a deletion for a user who is signed out everywhere but still exists", async () => {
    const userC = await createTestUser("deleteAccount");
    const signOut = await adminClient().auth.admin.signOut(userC.accessToken, "global");
    expect(signOut.error).toBeNull();

    const failure = await deleteMyAccount(userC.client).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    expect(failure).toBeInstanceOf(AccountDeletionError);
    expect(failure).toHaveProperty("code", "unconfirmed");
    expect(await userExists(userC.id)).toBe(true);
  });

  it("should leave the other user whole", async () => {
    expect(await userExists(userB.id)).toBe(true);
    const profile = await userB.client.from("profiles").select("id");
    expect(profile.error).toBeNull();
    expect(profile.data?.map(({ id }) => id)).toEqual([userB.id]);
  });
});
