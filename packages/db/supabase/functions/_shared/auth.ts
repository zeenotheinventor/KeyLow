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
  return data.user;
}

function unauthorized(): Response {
  return error("unauthorized", "Sign in to use this endpoint.");
}
