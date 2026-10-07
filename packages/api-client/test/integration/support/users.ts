import { adminClient, anonClient } from "./stack";

import type { Database } from "../../../src/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TestUser = {
  id: string;
  email: string;
  /** Signed in as this user, so every request carries the user's real JWT. */
  client: SupabaseClient<Database>;
};

// Vitest loads this module once per test file, so this only ever holds the current file's users.
const createdUserIds: string[] = [];

/** Creates a confirmed user through the admin API and signs in as them with a generated password. */
export async function createTestUser(suite: string): Promise<TestUser> {
  const email = `m2-${suite}-${crypto.randomUUID()}@keylow.test`;
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

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });

  if (signInError) {
    throw new Error(`Could not sign in as the test user ${email}`, { cause: signInError });
  }

  return { id: data.user.id, email, client };
}

/**
 * Deletes every user this file created and returns their ids. Their foods and portions go with
 * them (on delete cascade).
 */
export async function deleteCreatedTestUsers(): Promise<string[]> {
  const admin = adminClient();
  const ids = createdUserIds.splice(0);

  const results = await Promise.all(ids.map((id) => admin.auth.admin.deleteUser(id)));
  const failed = results.find(({ error }) => error !== null);

  if (failed?.error) {
    throw new Error("Could not delete a test user", { cause: failed.error });
  }

  return ids;
}
