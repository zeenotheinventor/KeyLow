import { useMutation } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { deleteMyAccount } from "../repos/deleteAccount";

/**
 * Deletes the signed in person's account for good (see `deleteMyAccount`). It never retries, and it never
 * waits for a connection: with the default `online` mode an offline tap would pause the mutation and send
 * the deletion later on its own, when the person is no longer looking at the confirmation. A deletion is
 * only ever sent while the confirmation is on screen. It invalidates nothing, because clearing the device
 * after a deletion is the app's job.
 */
export function useDeleteMyAccount() {
  const client = useSupabase();

  return useMutation({
    mutationFn: () => deleteMyAccount(client),
    retry: false,
    networkMode: "always",
  });
}
