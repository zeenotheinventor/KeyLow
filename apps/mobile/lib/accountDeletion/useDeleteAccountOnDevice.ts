import { useSupabase } from "@keylow/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteAccountOnDevice } from "./deleteAccountOnDevice";

/**
 * Deletes the signed in person's account and cleans this phone (see `deleteAccountOnDevice`). It never
 * retries, and it never waits for a connection: with the default `online` mode an offline tap would pause
 * the mutation and send the deletion later, when the person is no longer looking at the confirmation. A
 * deletion is only ever sent while the confirmation is on screen.
 */
export function useDeleteAccountOnDevice() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteAccountOnDevice({ client, queryClient }),
    retry: false,
    networkMode: "always",
  });
}
