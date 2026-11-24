import { useMutation } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { updatePassword } from "../repos/accountPassword";

/**
 * Sets a new password for the signed in user. The mutation resolves with the outcome and never rejects
 * for an auth failure, so a screen reads `kind` and shows the sentence it carries.
 */
export function useUpdatePassword() {
  const client = useSupabase();

  return useMutation({
    mutationFn: (input: { newPassword: string; context: "recovery" | "change" }) =>
      updatePassword(client, input),
  });
}
