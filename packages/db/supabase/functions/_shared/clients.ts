// The two Supabase clients a function needs. Supabase injects SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY into every deployed function and into `supabase functions serve`.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./core/database.types.ts";

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set`);
  }
  return value;
}

// Functions hold no session between requests.
const statelessAuth = { persistSession: false, autoRefreshToken: false };

// Bypasses RLS. Use it only for work the caller must not be able to do themselves, such as
// consuming a rate limit or writing shared rows. Never hand its results back unfiltered.
export function createServiceClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: statelessAuth,
    },
  );
}

// Acts as the caller: every query runs under their JWT, so RLS applies to it.
export function createCallerClient(request: Request): SupabaseClient<Database> {
  return createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    auth: statelessAuth,
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
}
