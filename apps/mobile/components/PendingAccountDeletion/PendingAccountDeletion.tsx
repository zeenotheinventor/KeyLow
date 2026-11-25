import { useSupabase } from "@keylow/api-client";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { isDeletionInFlight } from "../../lib/accountDeletion/deletionInFlight";
import { resumePendingAccountDeletion } from "../../lib/accountDeletion/resumePendingAccountDeletion";

/**
 * Draws nothing. Finishes an account deletion that was started on this phone and not finished (see
 * `resumePendingAccountDeletion`): when it mounts, when the app returns to the foreground, when the
 * connection returns, and when the session ends. It never sends a deletion. It mounts whether or not anyone
 * is signed in, because the case it is for often has no session left.
 */
export function PendingAccountDeletion() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  useEffect(() => {
    const resume = () => {
      resumePendingAccountDeletion({ client, queryClient }).catch(() => undefined);
    };
    resume();

    const appStateSubscription = AppState.addEventListener("change", (appState) => {
      if (appState === "active") {
        resume();
      }
    });
    const stopListeningForConnection = onlineManager.subscribe((isOnline) => {
      if (isOnline) {
        resume();
      }
    });
    let resumeAfterSignOut: ReturnType<typeof setTimeout> | undefined;
    const { data } = client.auth.onAuthStateChange((event) => {
      // Not while this app's own clean-up is running: its sign out sends this event, and a store that keeps
      // failing would otherwise keep the clean-up running again.
      if (event === "SIGNED_OUT" && !isDeletionInFlight()) {
        // Not from inside the listener: auth-js holds its lock while it calls it, and the run reads the session.
        resumeAfterSignOut = setTimeout(resume, 0);
      }
    });

    return () => {
      appStateSubscription.remove();
      stopListeningForConnection();
      data.subscription.unsubscribe();
      clearTimeout(resumeAfterSignOut);
    };
  }, [client, queryClient]);

  return null;
}
