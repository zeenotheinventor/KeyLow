import { isAuthApiError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { onlineManager } from "@tanstack/react-query";

import { signOut } from "../signOut";
import { isDeletionInFlight, trackDeletionInFlight } from "./deletionInFlight";
import { finishAccountDeletion } from "./finishAccountDeletion";
import { clearPendingAccountDeletion, readPendingAccountDeletion } from "./pendingAccountDeletion";
import { removeAccountKeyedData } from "./removeAccountDeviceData";

import type { ResumePendingAccountDeletionOptions } from "./types";

/** Clears the marker only if it still names `accountId`: a deletion of this app's own may have written one since. */
async function clearMarkerIfStill(accountId: string): Promise<void> {
  if ((await readPendingAccountDeletion()) === accountId) {
    await clearPendingAccountDeletion();
  }
}

async function resumeOnce({
  client,
  queryClient,
}: ResumePendingAccountDeletionOptions): Promise<void> {
  const markedAccountId = await readPendingAccountDeletion();
  // Offline nothing can be known, and a deletion in flight has its own answer coming. Both leave the marker.
  if (markedAccountId === null || !onlineManager.isOnline() || isDeletionInFlight()) {
    return;
  }

  const { data, error } = await client.auth.getSession();
  // A deletion that began while the session was being read has its own answer coming.
  if (isAuthRetryableFetchError(error) || isDeletionInFlight()) {
    return;
  }

  // The server's answer to a refused or missing session is not proof of a deletion (a sign out everywhere
  // gives the same one), so nothing is announced. The clean-up still runs: the person asked for it, and the
  // session is gone, so nothing of the account is left to protect by waiting.
  if (data.session === null) {
    await trackDeletionInFlight(() =>
      finishAccountDeletion({ accountId: markedAccountId, queryClient, signOut, announce: false }),
    );
    return;
  }

  if (data.session.user.id !== markedAccountId) {
    // Another account is signed in on this phone now, and that person deleted nothing. Only what is stored
    // under the marked account's id goes, so their settings stay. Tracked, so a deletion of this app's own
    // that starts meanwhile is not mistaken for this one.
    await trackDeletionInFlight(async () => {
      await removeAccountKeyedData(markedAccountId);
      await clearMarkerIfStill(markedAccountId);
    });
    return;
  }

  // The check never sends a deletion, and it passes the token so that auth-js does not refresh the session.
  const { error: lookupError } = await client.auth.getUser(data.session.access_token);
  if (isDeletionInFlight()) {
    return;
  }
  if (lookupError === null) {
    await clearMarkerIfStill(markedAccountId);
  } else if (
    isAuthApiError(lookupError) &&
    lookupError.code === "user_not_found" &&
    // An answer that was asked before a deletion of this app's own, and came after it finished, is stale:
    // that deletion has announced already and cleared the marker.
    (await readPendingAccountDeletion()) === markedAccountId
  ) {
    await trackDeletionInFlight(() =>
      finishAccountDeletion({ accountId: markedAccountId, queryClient, signOut, announce: true }),
    );
  }
}

let isRunning = false;
let isRunRequested = false;

function consumeRunRequest(): boolean {
  const wasRequested = isRunRequested;
  isRunRequested = false;
  return wasRequested;
}

/**
 * Finishes an account deletion that was started on this phone and not finished: the app was killed after
 * the request, or the phone could not tell whether the server deleted the account. It runs with a marker
 * (`markAccountDeletionPending`) and **never sends a deletion**. It announces the account as deleted only on
 * proof, which is the auth service saying the user does not exist. A session the server refuses proves
 * nothing, so then the clean-up runs and the person lands on Sign in with no notice. Offline, or with an
 * answer it cannot read, it waits for the next start, return to the foreground or return of the connection.
 *
 * A call made while one is running is not lost: auth-js sends SIGNED_OUT from inside the check when the
 * session was already signed out on the server, and the run that sees that needs to start again.
 */
export async function resumePendingAccountDeletion(
  options: ResumePendingAccountDeletionOptions,
): Promise<void> {
  if (isRunning) {
    isRunRequested = true;
    return;
  }

  isRunning = true;
  try {
    do {
      await resumeOnce(options);
    } while (consumeRunRequest());
  } finally {
    isRunning = false;
  }
}
