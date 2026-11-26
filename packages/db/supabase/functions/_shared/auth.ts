// Every function authenticates the caller itself, so correctness does not depend on the gateway's
// verify_jwt flag.
import { isAuthError, type User } from "@supabase/supabase-js";

import { createCallerClient } from "./clients.ts";
import { error } from "./http.ts";

const bearerPrefix = "Bearer ";

// Auth errors that mean the caller's credentials are bad. Anything else, such as the auth service
// being down, is not the caller's fault and must not tell them to sign in again.
const credentialErrorStatuses = [400, 401, 403];

// Returns the verified user, or the 401 response to send back. Auth verifies the token with a
// request, it does not trust the token's claims. An error that is not a credential problem is
// rethrown, so it reaches the caller as the handler wrapper's 500.
export async function requireUser(request: Request): Promise<User | Response> {
  const verified = await requireUserWithAmr(request);
  return verified instanceof Response ? verified : verified.user;
}

// The same check as `requireUser`, which wraps it so the two cannot drift, and it also returns the `amr`
// claim of the token: how and when the session was signed in. The claim is read only after auth has
// accepted that exact token, and auth rejects a token whose payload was rewritten (`bad_jwt`), so the
// claim is as trustworthy as the user. `amr` is `undefined` when the payload cannot be decoded.
export async function requireUserWithAmr(
  request: Request,
): Promise<{ user: User; amr: unknown } | Response> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith(bearerPrefix) ? header.slice(bearerPrefix.length) : "";
  if (token === "") {
    return unauthorized();
  }

  const { data, error: authError } = await createCallerClient(request).auth.getUser(token);
  if (authError !== null) {
    if (isAuthError(authError) && credentialErrorStatuses.includes(authError.status ?? 0)) {
      return unauthorized();
    }
    throw authError;
  }
  return { user: data.user, amr: readAmrClaim(token) };
}

// Reads the `amr` claim from a token's payload, the base64url JSON of its middle segment. It does not
// verify anything, so call it only on a token that auth has accepted. Never throws: a token that does
// not decode has no claim.
export function readAmrClaim(token: string): unknown {
  const segments = token.split(".");
  const payload = segments[1];
  if (segments.length !== 3 || payload === undefined) {
    return undefined;
  }

  try {
    const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (c) =>
      c.charCodeAt(0),
    );
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof claims === "object" && claims !== null && "amr" in claims
      ? claims.amr
      : undefined;
  } catch {
    return undefined;
  }
}

function unauthorized(): Response {
  return error("unauthorized", "Sign in to use this endpoint.");
}
