import { getSupabaseEnv } from "@/lib/supabase/env";

const CLEARED_ATTRIBUTES = "path=/; max-age=0; SameSite=Lax";

/**
 * The name the Supabase client keeps the session cookie under unless it is told another: `sb-` and the
 * first label of the project's host, then `-auth-token`. A long session is split into chunks named
 * `<key>.0`, `<key>.1` and so on.
 */
export function sessionCookieKeyOf(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0] ?? ""}-auth-token`;
}

/**
 * The `document.cookie` strings that expire this project's session cookies found in `cookieHeader`: the
 * session, its chunks and the sign-in code verifiers (the older single one, and the per-flow ones with
 * their index). Nothing else is named, so another project's session
 * and the theme cookie stay.
 */
export function describeClearedSessionCookies(cookieHeader: string, key: string): string[] {
  return cookieHeader
    .split(";")
    .map((pair) => pair.split("=")[0]?.trim() ?? "")
    .filter(
      (name) =>
        name === key ||
        name.startsWith(`${key}.`) ||
        name === `${key}-code-verifier` ||
        name === `${key}-flows-code-verifier` ||
        name.startsWith(`${key}-flow-`),
    )
    .map((name) => `${name}=; ${CLEARED_ATTRIBUTES}`);
}

/**
 * Removes the session cookies from this browser. The Supabase client writes them from the browser (they are
 * not httpOnly), so the page can expire them with no network.
 */
export function removeStoredSession(): void {
  const key = sessionCookieKeyOf(getSupabaseEnv().url);

  for (const cleared of describeClearedSessionCookies(document.cookie, key)) {
    document.cookie = cleared;
  }
}
