import { AccountDeletionError, deleteMyAccount } from "@keylow/api-client";

import { signOut } from "../signOut";
import { trackDeletionInFlight } from "./deletionInFlight";
import { finishAccountDeletion } from "./finishAccountDeletion";
import {
  clearPendingAccountDeletion,
  markAccountDeletionPending,
  readPendingAccountDeletion,
} from "./pendingAccountDeletion";

import type { DeleteAccountOnDeviceOptions, DeleteAccountOnDeviceResult } from "./types";

/**
 * Deletes the signed in person's account and, once the server confirms it, takes it off this phone. The
 * marker is written before the request, so an app killed after the server deleted the account finishes the
 * clean-up at the next start (`resumePendingAccountDeletion`). Only a confirmed deletion cleans anything:
 * `unconfirmed` keeps the marker and touches nothing, and a failure the server answered clears the marker.
 *
 * With a marker already there (a retry after `unconfirmed`) and no session left, the phone has nothing to
 * send with and cannot tell, so that is `unconfirmed` too and the marker stays for the start-up runner.
 */
async function runDeletion({
  client,
  queryClient,
}: DeleteAccountOnDeviceOptions): Promise<DeleteAccountOnDeviceResult> {
  const { data } = await client.auth.getSession();
  if (data.session === null) {
    const hasMarker = (await readPendingAccountDeletion()) !== null;
    return hasMarker ? { kind: "unconfirmed" } : { kind: "notDeleted", code: "unauthorized" };
  }

  const accountId = data.session.user.id;

  // The clean-up is inside the tracked call too: its own sign out sends SIGNED_OUT while the marker is
  // still there, and the start-up runner must not take that as a deletion of its own to finish.
  return trackDeletionInFlight<DeleteAccountOnDeviceResult>(async () => {
    await markAccountDeletionPending(accountId);
    try {
      await deleteMyAccount(client);
    } catch (failure) {
      // Anything but an answer of the deletion's own says nothing about the account, so it is unconfirmed too.
      if (!(failure instanceof AccountDeletionError) || failure.code === "unconfirmed") {
        return { kind: "unconfirmed" };
      }
      await clearPendingAccountDeletion();
      return { kind: "notDeleted", code: failure.code };
    }

    await finishAccountDeletion({ accountId, queryClient, signOut, announce: true });
    return { kind: "deleted" };
  });
}

let openCall: Promise<DeleteAccountOnDeviceResult> | null = null;

/**
 * Single flight: while a call is open, another returns the same promise and sends, writes and cleans
 * nothing, so a double tap is one deletion.
 */
export function deleteAccountOnDevice(
  options: DeleteAccountOnDeviceOptions,
): Promise<DeleteAccountOnDeviceResult> {
  openCall ??= runDeletion(options).finally(() => {
    openCall = null;
  });
  return openCall;
}
