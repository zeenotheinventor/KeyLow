import { NONCE_MINIMUM_LENGTH } from "./snapshot";

export type StartLinkInput = Readonly<{
  /** The `start` parameter of the link, as the router gives it. */
  start: string | undefined;
  /** The `nonce` parameter of the link. */
  nonce: string | undefined;
  /** The nonce of the snapshot the app last wrote, null when it has written none. */
  snapshotNonce: string | null;
  hasRunningSession: boolean;
  /** The routine day today plans, or null. */
  plannedDayId: string | null;
}>;

export type StartLinkDecision =
  | Readonly<{ type: "ignore" }>
  | Readonly<{ type: "open_running" }>
  | Readonly<{ type: "start"; routineDayId: string | null }>;

const IGNORE: StartLinkDecision = { type: "ignore" };

/**
 * What a `/session?start=` link does (ADR 0007, "Deep links and the nonce rule"). A link that would start
 * something acts only with the nonce of the snapshot the app last wrote, so another app or a web page that
 * opens a `keylow://` link writes nothing. With a session already running the link opens that one.
 */
export const resolveStartLink = ({
  start,
  nonce,
  snapshotNonce,
  hasRunningSession,
  plannedDayId,
}: StartLinkInput): StartLinkDecision => {
  const isTrusted =
    nonce !== undefined && nonce === snapshotNonce && nonce.length >= NONCE_MINIMUM_LENGTH;
  if (!isTrusted || (start !== "planned" && start !== "empty")) {
    return IGNORE;
  }
  if (hasRunningSession) {
    return { type: "open_running" };
  }
  if (start === "empty") {
    return { type: "start", routineDayId: null };
  }

  return plannedDayId === null ? IGNORE : { type: "start", routineDayId: plannedDayId };
};
