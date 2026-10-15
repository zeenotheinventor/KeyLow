import { useTermsAcceptance } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { needsTermsAcceptance } from "@keylow/core/terms";

/**
 * Whether a screen may read the signed in user's data. The tabs and the screens pushed over them stay
 * mounted under the terms gate's cover, so every read waits until the account has accepted the current
 * Terms. The acceptance is the gate's own query, shared through the cache. One that is not known yet
 * counts as not accepted, so nothing is fetched while the gate is loading.
 */
export function useReadsEnabled(): boolean {
  const acceptance = useTermsAcceptance();

  return !needsTermsAcceptance(acceptance.data ?? null, TERMS_VERSION);
}
