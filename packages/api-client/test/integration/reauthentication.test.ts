import { isAuthApiError } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { adminClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import {
  amrOf,
  claimsOf,
  passwordTimestampOf,
  signInWithLink,
} from "../../../db/test/integration/support/authSessions";
import { requireServedFunction } from "../../../db/test/integration/support/functionsLane";
import { reauthenticateWithPassword } from "../../src/repos/accountPassword";
import { AccountDeletionError, deleteMyAccount } from "../../src/repos/deleteAccount";

import type { TestUser } from "./support/users";

/*
 * The facts about the local auth service that `delete-account`'s freshness rule rests on, pinned with real
 * tokens so an upgrade of the auth service that changes one turns this suite red. Then
 * `reauthenticateWithPassword` and `deleteMyAccount` end to end against the served function.
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

const currentAccessToken = async (user: TestUser): Promise<string | undefined> =>
  (await user.client.auth.getSession()).data.session?.access_token;

describe("reauthentication against the local stack with real user JWTs", () => {
  beforeAll(async () => {
    await requireServedFunction(inject("stack"), "delete-account");
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  describe("what the auth service puts in a token", () => {
    it("should give a password sign in one password entry within a few seconds of now", async () => {
      const user = await createTestUser("reauthentication");

      const amr = amrOf(user.accessToken);

      expect(Array.isArray(amr) ? amr : []).toHaveLength(1);
      expect(Array.isArray(amr) ? amr[0] : undefined).toMatchObject({ method: "password" });
      expect(Math.abs(Date.now() / 1000 - passwordTimestampOf(user.accessToken))).toBeLessThan(30);
    });

    it("should keep the session and the time of the password sign in through a refresh", async () => {
      const user = await createTestUser("reauthentication");
      const { data, error } = await user.client.auth.refreshSession();
      expect(error).toBeNull();
      const refreshed = data.session?.access_token ?? "";

      expect(refreshed).not.toBe("");
      expect(claimsOf(refreshed)["session_id"]).toBe(claimsOf(user.accessToken)["session_id"]);
      expect(passwordTimestampOf(refreshed)).toBe(passwordTimestampOf(user.accessToken));
    });

    it("should give a recovery link session an otp entry and no password entry", async () => {
      const user = await createTestUser("reauthentication");

      const { accessToken } = await signInWithLink(user, "recovery");

      const amr = amrOf(accessToken);
      expect(amr).toEqual([{ method: "otp", timestamp: expect.any(Number) as number }]);
    });
  });

  describe("reauthenticateWithPassword", () => {
    it("should confirm the right password with a token whose password entry is no older than the call", async () => {
      const user = await createTestUser("reauthentication");
      const calledAt = Math.floor(Date.now() / 1000);

      const outcome = await reauthenticateWithPassword(user.client, { password: user.password });

      expect(outcome).toEqual({ kind: "confirmed" });
      const token = (await currentAccessToken(user)) ?? "";
      expect(passwordTimestampOf(token)).toBeGreaterThanOrEqual(calledAt);
      expect(claimsOf(token)["session_id"]).not.toBe(claimsOf(user.accessToken)["session_id"]);
    });

    it("should refuse a wrong password and leave the access token as it was", async () => {
      const user = await createTestUser("reauthentication");

      const outcome = await reauthenticateWithPassword(user.client, {
        password: `wrong-${crypto.randomUUID()}`,
      });

      expect(outcome).toEqual({ kind: "wrongPassword" });
      expect(await currentAccessToken(user)).toBe(user.accessToken);
    });
  });

  describe("with the functions served", () => {
    it("should delete the account after a fresh password sign in", async () => {
      const user = await createTestUser("reauthentication");
      expect(await reauthenticateWithPassword(user.client, { password: user.password })).toEqual({
        kind: "confirmed",
      });

      const result = await deleteMyAccount(user.client);

      expect(result).toEqual({ deleted: true, confirmedBy: "response" });
      expect(await userExists(user.id)).toBe(false);
    });

    it("should throw reauthentication_required for a recovery session and keep the account", async () => {
      const user = await createTestUser("reauthentication");
      const { client } = await signInWithLink(user, "recovery");

      const failure = await deleteMyAccount(client).then(
        () => null,
        (thrown: unknown) => thrown,
      );

      expect(failure).toBeInstanceOf(AccountDeletionError);
      expect(failure).toHaveProperty("code", "reauthentication_required");
      expect(await userExists(user.id)).toBe(true);
    });
  });
});
