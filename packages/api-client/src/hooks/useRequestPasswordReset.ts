import { useMutation } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { requestPasswordReset } from "../repos/accountPassword";

/**
 * Asks for a password reset link. The mutation resolves with the outcome and never rejects for an auth
 * failure, so a screen reads `kind` and shows the sentence it carries.
 */
export function useRequestPasswordReset() {
  const client = useSupabase();

  return useMutation({
    mutationFn: (input: { email: string; redirectTo: string }) =>
      requestPasswordReset(client, input),
  });
}
