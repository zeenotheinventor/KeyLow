function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether the account signs in with a password, from the user's `app_metadata`. True when `providers` is an
 * array that includes "email", or, when `providers` is missing, when `provider` is "email". Any other shape is
 * false, so the Change password row is hidden. Supabase documents `providers: ["google"]` for a Google-only
 * user and `["email", "google"]` once both are linked. The Google-only value has not been checked on the local
 * stack, where Google is not configured.
 */
export function hasPasswordSignIn(appMetadata: unknown): boolean {
  if (!isRecord(appMetadata)) {
    return false;
  }

  const { providers, provider } = appMetadata;

  if (providers === undefined) {
    return provider === "email";
  }

  return Array.isArray(providers) && providers.includes("email");
}
