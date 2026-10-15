import type { UpdateCheckResult, UpdateFetchResult } from "expo-updates";

// The results carry a full update manifest that these tests never read, and the code under test reads
// only `isAvailable`, `isNew` and `manifest.id`. Building the full manifest would be noise, so each result
// is made by this one cast, which fits whichever result type the caller declares, and the tests ask for
// the result they mean.
function asResult(result: object): never {
  return result as never;
}

export function availableCheck(id: string): UpdateCheckResult {
  return asResult({
    isAvailable: true,
    isRollBackToEmbedded: false,
    manifest: { id },
  });
}

export function noUpdateCheck(): UpdateCheckResult {
  return asResult({
    isAvailable: false,
    isRollBackToEmbedded: false,
    manifest: undefined,
  });
}

export function newFetch(id: string): UpdateFetchResult {
  return asResult({
    isNew: true,
    isRollBackToEmbedded: false,
    manifest: { id },
  });
}

export function nothingNewFetch(): UpdateFetchResult {
  return asResult({
    isNew: false,
    isRollBackToEmbedded: false,
    manifest: undefined,
  });
}
