import { onlineManager } from "@tanstack/react-query";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Signs the person out of this browser, whether or not the server can be reached. It is the phone's
 * `endSession` with the web's way of removing the stored session (cookies, not secure storage).
 *
 * Supabase's `signOut` first reads the session, and offline with an access token that has expired that read
 * tries a refresh and fails. It then returns the error and stops: the session is not removed and no
 * SIGNED_OUT event is sent. So when the browser is offline, or `signOut` returns an error, the stored session
 * is removed here and a local sign out is then run, which has nothing left to read and so sends SIGNED_OUT.
 * The query cache resets on that event. The server is not told when it cannot be reached.
 */
export async function endSession(
  auth: Pick<SupabaseClient["auth"], "signOut">,
  removeStoredSession: () => void,
): Promise<void> {
  if (onlineManager.isOnline()) {
    // Local scope, as the sign out has always been here: it ends this browser's session, not the others.
    const { error } = await auth.signOut({ scope: "local" });
    if (error === null) {
      return;
    }
  }

  removeStoredSession();
  await auth.signOut({ scope: "local" });
}
