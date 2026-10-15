import type { SupabaseStatus } from "../supabaseStatus";

export type SupabaseConnection = { url: string; serviceRoleKey: string };

/**
 * The Supabase project to import into. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY name any project,
 * and with neither set the local stack that `supabase status` reports is used. Setting only one of
 * them is an error, so a half-configured run never falls back to the local stack unnoticed.
 */
export async function resolveConnection(
  environment: Readonly<Record<string, string | undefined>>,
  readLocalStatus: () => Promise<SupabaseStatus>,
): Promise<SupabaseConnection> {
  const url = environment["SUPABASE_URL"] || undefined;
  const serviceRoleKey = environment["SUPABASE_SERVICE_ROLE_KEY"] || undefined;

  if (url !== undefined && serviceRoleKey !== undefined) {
    return { url, serviceRoleKey };
  }
  if (url !== undefined || serviceRoleKey !== undefined) {
    const missing = url === undefined ? "SUPABASE_URL" : "SUPABASE_SERVICE_ROLE_KEY";
    throw new Error(
      `${missing} is not set. Set both variables, or neither to use the local stack.`,
    );
  }

  const local = await readLocalStatus();
  return { url: local.apiUrl, serviceRoleKey: local.serviceRoleKey };
}
