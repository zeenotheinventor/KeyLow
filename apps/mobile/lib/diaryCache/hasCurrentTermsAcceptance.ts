import { keys } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { needsTermsAcceptance } from "@keylow/core/terms";
import { hashKey } from "@tanstack/react-query";

import type { TermsAcceptance } from "@keylow/core/terms";
import type { DehydratedState } from "@tanstack/react-query";

const termsAcceptanceHash = hashKey(keys.profiles.termsAcceptance);

function toTermsAcceptance(data: unknown): TermsAcceptance | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  return {
    terms_accepted_at:
      "terms_accepted_at" in data && typeof data.terms_accepted_at === "string"
        ? data.terms_accepted_at
        : null,
    terms_version:
      "terms_version" in data && typeof data.terms_version === "string" ? data.terms_version : null,
  };
}

/**
 * Whether the stored cache knows its account has accepted the current Terms. A cache that does not
 * says nothing of the kind, or says the account has not, so it is not read: the terms gate stops
 * such an account from seeing the app, and a cache read before the gate decided would put its data
 * in memory behind the cover anyway. Fails closed.
 */
export function hasCurrentTermsAcceptance(state: DehydratedState): boolean {
  const query = state.queries.find(({ queryHash }) => queryHash === termsAcceptanceHash);

  return (
    query !== undefined && !needsTermsAcceptance(toTermsAcceptance(query.state.data), TERMS_VERSION)
  );
}
