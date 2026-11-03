import { onlineManager } from "@tanstack/react-query";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Signs the person out of this phone, whether or not the server can be reached.
 *
 * Supabase's `signOut` first reads the session, and offline with an access token that has expired that read
 * tries a refresh and fails. It then returns the error and stops: the session is not removed and no
 * SIGNED_OUT event is sent, so the person would stay signed in with their cache. So when the app is offline,
 * or `signOut` returns an error, the stored session is removed here, and a local sign out is then run, which
 * has nothing left to read and so sends SIGNED_OUT. Everything that listens for it (the sign-in gate, the
 * query cache and the stored diary cache) then does its part. The server is not told when it cannot be reached.
 *
 * The widgets' snapshot and pending-undo record are deleted and the widgets redrawn signed out (ADR 0007).
 */
export async function endSession(
  auth: Pick<SupabaseClient["auth"], "signOut">,
  removeStoredSession: () => Promise<void>,
  clearWidgets: () => Promise<void> = () => Promise.resolve(),
): Promise<void> {
  // The widgets show the last account's numbers on the home screen, so they go first, whether or not the
  // server can be reached. A failure to delete them must not keep the person signed in.
  await clearWidgets().catch(() => undefined);

  if (onlineManager.isOnline()) {
    const { error } = await auth.signOut();
    if (error === null) {
      return;
    }
  }

  await removeStoredSession();
  await auth.signOut({ scope: "local" });
}
