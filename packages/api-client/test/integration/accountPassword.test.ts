import { PASSWORD_PROBLEMS } from "@keylow/core/copy";
import { afterAll, describe, expect, it, vi } from "vitest";

import { adminClient, anonClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { requestPasswordReset, updatePassword } from "../../src/repos/accountPassword";

const REDIRECT_TO = "keylow://auth/callback";

/**
 * A test user whose password this test knows, because `TestUser` does not expose its own. Passwords are
 * built at runtime and never printed.
 */
async function createUserWithKnownPassword() {
  const user = await createTestUser("accountPassword");
  const password = `pw-${crypto.randomUUID()}`;
  const { error } = await adminClient().auth.admin.updateUserById(user.id, { password });

  if (error) {
    throw new Error("Could not set the test user's password", { cause: error });
  }

  return { user, password };
}

async function signInWith(email: string, password: string) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error("Could not sign in as the test user", { cause: error });
  }

  return client;
}

describe("password reset and change against the local stack", () => {
  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should give a known and an unknown address the same answer", async () => {
    const { user } = await createUserWithKnownPassword();
    const unknownEmail = `integration-accountPassword-${crypto.randomUUID()}@keylow.test`;

    const known = await requestPasswordReset(anonClient(), {
      email: user.email,
      redirectTo: REDIRECT_TO,
    });
    const unknown = await requestPasswordReset(anonClient(), {
      email: unknownEmail,
      redirectTo: REDIRECT_TO,
    });

    // `unexpectedCode` is not compared. CI has no mail server, so a known address can answer with a
    // server error there and a 200 here, and both must read as sent.
    expect(known.kind).toBe("sent");
    expect(unknown.kind).toBe("sent");
    expect(known).not.toHaveProperty("message");
    expect(unknown).not.toHaveProperty("message");
  });

  it("should let a recovery session set a new password and end every other session", async () => {
    const { user, password } = await createUserWithKnownPassword();
    const otherDevice = await signInWith(user.email, password);
    const { data: link, error: linkError } = await adminClient().auth.admin.generateLink({
      type: "recovery",
      email: user.email,
    });

    if (linkError) {
      throw new Error("Could not generate a recovery link", { cause: linkError });
    }

    const recoveryClient = anonClient();
    const events: string[] = [];
    recoveryClient.auth.onAuthStateChange((event) => {
      events.push(event);
    });
    const { error: verifyError } = await recoveryClient.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "recovery",
    });
    expect(verifyError).toBeNull();
    await vi.waitFor(() => {
      expect(events).toContain("PASSWORD_RECOVERY");
    });

    const newPassword = `pw-${crypto.randomUUID()}`;
    const outcome = await updatePassword(recoveryClient, { newPassword, context: "recovery" });

    expect(outcome).toEqual({ kind: "saved", otherDevicesSignedOut: true });
    const oldPasswordSignIn = await anonClient().auth.signInWithPassword({
      email: user.email,
      password,
    });
    expect(oldPasswordSignIn.error).not.toBeNull();
    const newPasswordSignIn = await anonClient().auth.signInWithPassword({
      email: user.email,
      password: newPassword,
    });
    expect(newPasswordSignIn.error).toBeNull();
    const otherDeviceRefresh = await otherDevice.auth.refreshSession();
    expect(otherDeviceRefresh.error).not.toBeNull();
    const { data: kept } = await recoveryClient.auth.getSession();
    expect(kept.session).not.toBeNull();
  });

  it("should refuse the current password as the new one", async () => {
    const { user, password } = await createUserWithKnownPassword();
    const client = await signInWith(user.email, password);

    const outcome = await updatePassword(client, { newPassword: password, context: "change" });

    expect(outcome).toMatchObject({ kind: "failed", reason: "samePassword" });
  });

  it("should refuse a password the server finds too short", async () => {
    const { user, password } = await createUserWithKnownPassword();
    const client = await signInWith(user.email, password);

    const outcome = await updatePassword(client, {
      newPassword: crypto.randomUUID().slice(0, 5),
      context: "change",
    });

    expect(outcome).toMatchObject({ kind: "failed", reason: "weakPassword" });
  });

  it.each([
    ["recovery", PASSWORD_PROBLEMS.resetTimedOut],
    ["change", PASSWORD_PROBLEMS.changeSessionEnded],
  ] as const)(
    "should say the session ended with no session in the %s context",
    async (context, message) => {
      const outcome = await updatePassword(anonClient(), {
        newPassword: `pw-${crypto.randomUUID()}`,
        context,
      });

      expect(outcome).toEqual({ kind: "failed", reason: "sessionEnded", message });
    },
  );
});
