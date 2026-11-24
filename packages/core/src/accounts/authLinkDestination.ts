import { isRecentRecoveryRequest } from "./recoveryRequest";

/** What the auth callback made of the link. Both apps' callbacks return it. */
export type AuthLinkResult = { kind: "signedIn" } | { kind: "recovery" } | { kind: "failed" };

export type AuthLinkDestination =
  "home" | "setNewPassword" | "resetLinkInvalid" | "signInLinkInvalid";

/**
 * Where an opened email link leads. The type of a link that worked comes from Supabase, never from the
 * marker. A failed reset link and a failed sign up link look the same to the callback, because on an error
 * Supabase sends no type. So each app records when a reset was requested on the device, and a failure within
 * the link's lifetime of that is shown as a reset link failure. A sign up link that fails within an hour of a
 * reset request on the same device shows the reset error, which still offers a working way forward.
 */
export function authLinkDestination({
  result,
  recoveryRequestedAt,
  now,
}: {
  result: AuthLinkResult;
  recoveryRequestedAt: number | null;
  now: number;
}): AuthLinkDestination {
  switch (result.kind) {
    case "signedIn":
      return "home";
    case "recovery":
      return "setNewPassword";
    case "failed":
      return isRecentRecoveryRequest(recoveryRequestedAt, now)
        ? "resetLinkInvalid"
        : "signInLinkInvalid";
  }
}
