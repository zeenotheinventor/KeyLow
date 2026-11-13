export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (see apps/web/.env.example)",
    );
  }

  return { url, anonKey };
}

/** The base URL of the project's Edge Functions, which the assistant's status and turn routes are under. */
export function getFunctionsUrl() {
  return `${getSupabaseEnv().url.replace(/\/+$/, "")}/functions/v1`;
}
