import type { Targets } from "@keylow/api-client";

export type EngineTargetsProps = {
  /** The current targets of the programme. */
  targets: Targets;
  /** The date the current targets began, `YYYY-MM-DD`, once it is known. Nothing is said of it before. */
  since: string | undefined;
  /** Whether the app can reach the server. Set my own targets saves, so it is off without a connection. */
  isOnline: boolean;
  onSetOwnTargets: () => void;
};
