import { announceAccountDeleted } from "./accountDeletedNotice";
import { clearPendingAccountDeletion } from "./pendingAccountDeletion";
import { removeAccountDeviceData } from "./removeAccountDeviceData";
import { DIARY_CACHE_STORAGE_KEY } from "../diaryCache/constants";
import { createDiaryCacheStorage } from "../diaryCache/createDiaryCacheStorage";

import type { QueryClient } from "@tanstack/react-query";

type FinishAccountDeletionOptions = Readonly<{
  accountId: string;
  queryClient: Pick<QueryClient, "cancelQueries" | "clear">;
  /** `signOut` of `lib/signOut.ts`. */
  signOut: () => Promise<void>;
  /** Whether the sign-in screen may say the account is deleted. Only a proof of it allows that. */
  announce: boolean;
}>;

/** A step that fails must not stop the ones after it: a half-finished clean-up is worse than a noisy one. */
async function attempt(step: () => unknown): Promise<void> {
  try {
    await step();
  } catch {
    // Nothing to do: the next step runs, and the marker is cleared last, so a relaunch is told nothing false.
  }
}

/**
 * Takes the deleted account off this phone, in this order:
 * 1. The query cache is dropped with `clear()`. `resetQueries()` would refetch every active query with a
 *    session that is gone, and would leave paused writes in the mutation cache to be replayed.
 * 2. The device data of the account, and the stored diary cache directly, because a refused token refresh
 *    can send SIGNED_OUT before this runs, and the diary cache's own listener may already have missed it.
 * 3. The notice, so the sign-in screen finds it when it mounts after the sign out.
 * 4. The sign out. After a server deletion auth-js's local sign out gets a 401, 403 or 404 from `/logout`,
 *    ignores it, removes the session and sends SIGNED_OUT (`GoTrueClient._signOut`, `_removeSession`), and
 *    `endSession` removes the stored session itself when offline.
 * 5. The pending marker, last, so an app killed anywhere above finishes the clean-up at the next start.
 * Every step is attempted whatever the earlier ones did, and nothing is thrown.
 */
export async function finishAccountDeletion({
  accountId,
  queryClient,
  signOut,
  announce,
}: FinishAccountDeletionOptions): Promise<void> {
  await attempt(() => queryClient.cancelQueries());
  await attempt(() => {
    queryClient.clear();
  });
  await attempt(() => removeAccountDeviceData(accountId));
  await attempt(() => createDiaryCacheStorage().removeItem(DIARY_CACHE_STORAGE_KEY));
  if (announce) {
    announceAccountDeleted();
  }
  await attempt(signOut);
  await clearPendingAccountDeletion();
}
