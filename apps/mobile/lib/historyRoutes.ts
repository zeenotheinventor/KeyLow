import type { SessionOrigin } from "@keylow/core/copy";

/** The history list, a screen pushed inside the Train tab so the tab bar stays. */
export const historyPath = (): string => "/train/history";

/**
 * One logged session's detail, pushed over the history list or over the Train home. The detail names its
 * Back control for the screen it was opened from, so an address opened from the Train home says so.
 */
export const sessionDetailPath = (sessionId: string, origin: SessionOrigin = "history"): string =>
  `${historyPath()}/${sessionId}${origin === "train" ? "?from=train" : ""}`;
