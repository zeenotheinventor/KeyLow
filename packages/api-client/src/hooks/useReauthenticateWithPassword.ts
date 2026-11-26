import { useMutation } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { reauthenticateWithPassword } from "../repos/accountPassword";

/**
 * Signs the signed in person in again with their password (see `reauthenticateWithPassword`), which gives the
 * session the fresh password sign-in that `delete-account` asks for. The mutation resolves with the outcome and
 * never rejects for an auth failure. It never retries. It does not wait for a connection: with the default
 * `online` mode an offline press would pause and send the password later, unseen. `gcTime: 0` drops the
 * mutation, with the password in its variables, from the cache as soon as nothing observes it. It invalidates
 * nothing.
 */
export function useReauthenticateWithPassword() {
  const client = useSupabase();

  return useMutation({
    mutationFn: (input: { password: string }) => reauthenticateWithPassword(client, input),
    retry: false,
    networkMode: "always",
    gcTime: 0,
  });
}
