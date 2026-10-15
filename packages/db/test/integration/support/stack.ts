import { createClient } from "@supabase/supabase-js";
import { inject } from "vitest";

import type { SupabaseStatus } from "../../../scripts/supabaseStatus";
import type { Database } from "../../../src/types.gen";
import type { SupabaseClient } from "@supabase/supabase-js";

/** What the global setup reads from `supabase status` and hands to every test file. */
export type StackConfig = SupabaseStatus;

declare module "vitest" {
  export interface ProvidedContext {
    stack: StackConfig;
  }
}

// Sessions are never persisted or refreshed, so each client is a self-contained caller.
const stateless = { auth: { persistSession: false, autoRefreshToken: false } };

/** A client with the anon key and no session, which signs users in. */
export const anonClient = (): SupabaseClient<Database> => {
  const { apiUrl, anonKey } = inject("stack");
  return createClient<Database>(apiUrl, anonKey, stateless);
};

/** A client with the service role key. It bypasses RLS and is only for creating and checking test data. */
export const adminClient = (): SupabaseClient<Database> => {
  const { apiUrl, serviceRoleKey } = inject("stack");
  return createClient<Database>(apiUrl, serviceRoleKey, stateless);
};
