/** What a profile records about the Terms acceptance. Both are null until the user accepts. */
export type TermsAcceptance = {
  terms_accepted_at: string | null;
  terms_version: string | null;
};

/**
 * Whether the user has to accept the terms (again) before going on. True when there is no profile
 * row, when nothing was ever accepted, and when the accepted version is not `currentVersion`.
 * Versions are compared as exact strings and never ordered, so any different version, older or
 * newer, means accept again.
 */
export function needsTermsAcceptance(
  acceptance: TermsAcceptance | null,
  currentVersion: string,
): boolean {
  if (acceptance === null) {
    return true;
  }

  if (acceptance.terms_accepted_at === null || acceptance.terms_version === null) {
    return true;
  }

  return acceptance.terms_version !== currentVersion;
}
