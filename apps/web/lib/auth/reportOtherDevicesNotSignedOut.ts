import { captureMessage } from "@sentry/nextjs";

/**
 * Reports a saved password whose other sessions could not be signed out. The person still sees the saved
 * state as drawn. The message is fixed and carries no data, so no account can be picked out from a report.
 */
export function reportOtherDevicesNotSignedOut(): void {
  captureMessage("A saved password did not sign out the other devices", { level: "warning" });
}
