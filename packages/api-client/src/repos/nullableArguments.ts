import type { Database } from "../database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The arguments of a database function with one argument that may be null. Postgres records no
 * nullability for function arguments, so the generated types name the id a plain string while the
 * function takes a null to create a row (or, for `set_active_routine`, to clear one).
 */
export type WithNullable<Args, Key extends keyof Args> = Omit<Args, Key> & {
  [Name in Key]: Args[Name] | null;
};

/**
 * A client typed without the database schema, so it carries the null the generated types cannot. A type
 * cast would hide a real mismatch, so each call site ties its arguments to the generated ones with
 * `satisfies WithNullable<...>`, and a renamed or retyped argument breaks the build. What comes back is
 * parsed before it is used.
 */
export function untypedFunctions(client: SupabaseClient<Database>): SupabaseClient {
  return client;
}
