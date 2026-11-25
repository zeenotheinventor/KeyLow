import { authLinkDestination, type AuthLinkResult } from "@keylow/core/accounts";
import { NextResponse, type NextRequest } from "next/server";

import type { EmailOtpType } from "@supabase/supabase-js";

import {
  RECOVERY_REQUESTED_COOKIE,
  readRecoveryRequestedAt,
} from "@/lib/auth/recoveryRequestedCookie";
import { TERMS_PENDING_COOKIE, readPendingTermsVersion } from "@/lib/auth/termsPendingCookie";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT_PATH = "/dashboard";
const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function resolveNext(next: string | null, origin: string) {
  const fallback = new URL(DEFAULT_NEXT_PATH, origin);
  if (next === null || !next.startsWith("/")) {
    return fallback;
  }

  // The URL parser drops tabs and newlines, so "/\t/host" would resolve to another origin.
  const target = new URL(next, origin);

  return target.origin === origin ? target : fallback;
}

// The `accept_terms` function is called here and not through `acceptTerms` in the api-client package,
// because that package only exports one entry point, which pulls React hooks into this route.
// The sign-up page leaves the version in a cookie before it sends someone to Google. A failure to
// record it must not stop the sign-in. The accept-to-continue screen asks again if it was missed.
async function recordPendingTermsAcceptance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  request: NextRequest,
) {
  const version = readPendingTermsVersion(request.cookies.get(TERMS_PENDING_COOKIE)?.value);
  if (version === null) {
    return;
  }

  try {
    const { error } = await supabase.rpc("accept_terms", { p_version: version });
    if (error) {
      console.error("Could not record the Terms acceptance", error);
    }
  } catch (error) {
    console.error("Could not record the Terms acceptance", error);
  }
}

async function completeSignIn(request: NextRequest): Promise<AuthLinkResult> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const emailOtpType = EMAIL_OTP_TYPES.find((type) => type === searchParams.get("type"));

  if (!code && !(tokenHash && emailOtpType)) {
    return { kind: "failed" };
  }

  const supabase = await createClient();
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { kind: "failed" };
    }
    // Under PKCE the reset request stored its verifier with a recovery suffix, and that is where the
    // redirect type comes from. The client returns it at run time but does not declare it in its types.
    if (typeof data === "object" && "redirectType" in data && data.redirectType === "recovery") {
      return { kind: "recovery" };
    }
    await recordPendingTermsAcceptance(supabase, request);
    return { kind: "signedIn" };
  }

  if (tokenHash && emailOtpType) {
    const { error } = await supabase.auth.verifyOtp({ type: emailOtpType, token_hash: tokenHash });
    if (error) {
      return { kind: "failed" };
    }
    return emailOtpType === "recovery" ? { kind: "recovery" } : { kind: "signedIn" };
  }

  return { kind: "failed" };
}

function redirectFor(request: NextRequest, result: AuthLinkResult) {
  const { searchParams, origin } = request.nextUrl;
  const destination = authLinkDestination({
    result,
    recoveryRequestedAt: readRecoveryRequestedAt(
      request.cookies.get(RECOVERY_REQUESTED_COOKIE)?.value,
    ),
    now: Date.now(),
  });

  switch (destination) {
    case "home":
      return NextResponse.redirect(resolveNext(searchParams.get("next"), origin));
    case "setNewPassword":
      // A reset link must not carry the person anywhere else, so `next` is ignored.
      return NextResponse.redirect(new URL("/set-password", origin));
    case "resetLinkInvalid":
      return NextResponse.redirect(new URL("/forgot-password/link-not-valid", origin));
    case "signInLinkInvalid":
      return NextResponse.redirect(new URL("/login?error=callback", origin));
  }
}

export async function GET(request: NextRequest) {
  const result = await completeSignIn(request);
  const response = redirectFor(request, result);
  if (result.kind === "recovery") {
    response.cookies.delete(RECOVERY_REQUESTED_COOKIE);
  }
  // The cookie is good for one sign-in only, whatever came of it.
  response.cookies.delete(TERMS_PENDING_COOKIE);

  return response;
}
