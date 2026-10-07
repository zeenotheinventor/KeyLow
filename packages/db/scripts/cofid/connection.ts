export type SupabaseConnection = { url: string; serviceRoleKey: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * The Supabase project to import into. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY name any project,
 * and with neither set the local stack that `supabase status` reports is used. Setting only one of
 * them is an error, so a half-configured run never falls back to the local stack unnoticed.
 */
export async function resolveConnection(
  environment: Readonly<Record<string, string | undefined>>,
  readLocalStatus: () => Promise<unknown>,
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

  const status = await readLocalStatus();
  if (
    !isRecord(status) ||
    typeof status["API_URL"] !== "string" ||
    typeof status["SERVICE_ROLE_KEY"] !== "string"
  ) {
    throw new Error("API_URL or SERVICE_ROLE_KEY is missing from the `supabase status` output");
  }
  return { url: status["API_URL"], serviceRoleKey: status["SERVICE_ROLE_KEY"] };
}
