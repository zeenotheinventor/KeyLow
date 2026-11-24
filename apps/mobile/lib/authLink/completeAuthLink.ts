import { supabase } from "../supabase";

import type { AuthLinkResult } from "@keylow/core/accounts";
import type { EmailOtpType } from "@supabase/supabase-js";

const emailOtpTypes: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function toEmailOtpType(value: string | undefined): EmailOtpType | undefined {
  return emailOtpTypes.find((emailOtpType) => emailOtpType === value);
}

/**
 * What the link did. Why one failed is for the server's log and not the screen: the board draws one
 * sentence for a link that cannot be used, whatever went wrong with it, including a call that threw, so
 * the screen never waits for ever.
 */
export async function completeAuthLink({
  code,
  tokenHash,
  type,
}: {
  code: string | undefined;
  tokenHash: string | undefined;
  type: string | undefined;
}): Promise<AuthLinkResult> {
  const emailOtpType = toEmailOtpType(type);

  try {
    if (code !== undefined) {
      // Under PKCE the reset request stored its verifier with a recovery suffix, and that is where the
      // redirect type comes from. The client returns it at run time but does not declare it in its types.
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error !== null) {
        return { kind: "failed" };
      }
      const isRecovery = "redirectType" in data && data.redirectType === "recovery";
      return isRecovery ? { kind: "recovery" } : { kind: "signedIn" };
    }

    if (tokenHash !== undefined && emailOtpType !== undefined) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: emailOtpType,
      });
      if (error !== null) {
        return { kind: "failed" };
      }
      return emailOtpType === "recovery" ? { kind: "recovery" } : { kind: "signedIn" };
    }
  } catch {
    return { kind: "failed" };
  }

  return { kind: "failed" };
}
