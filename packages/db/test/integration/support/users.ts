import { adminClient, anonClient } from "./stack";

export type TestUser = {
  id: string;
  email: string;
  /** The user's real JWT, sent as the bearer token of a function call. */
  accessToken: string;
};

// Vitest loads this module once per test file, so this only ever holds the current file's users.
const createdUserIds: string[] = [];

/**
 * Creates a confirmed user through the admin API and signs in as them with a generated password.
 * The email is `<prefix>-<random>@test.local`, so a stray user from a crashed run is easy to spot.
 */
export async function createTestUser(prefix: string): Promise<TestUser> {
  const email = `${prefix}-${crypto.randomUUID()}@test.local`;
  const password = crypto.randomUUID();

  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Could not create the test user ${email}`, { cause: error });
  }

  createdUserIds.push(data.user.id);

  const { data: signedIn, error: signInError } = await anonClient().auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw new Error(`Could not sign in as the test user ${email}`, { cause: signInError });
  }

  return { id: data.user.id, email, accessToken: signedIn.session.access_token };
}

/** Deletes every user this file created. Their own rows go with them (on delete cascade). */
export async function deleteCreatedTestUsers(): Promise<void> {
  const admin = adminClient();
  const ids = createdUserIds.splice(0);

  const results = await Promise.all(ids.map((id) => admin.auth.admin.deleteUser(id)));
  const failed = results.find(({ error }) => error !== null);

  if (failed?.error) {
    throw new Error("Could not delete a test user", { cause: failed.error });
  }
}
