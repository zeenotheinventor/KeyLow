import type { PendingUndo } from "./snapshot";

/** What a tap on a widget does: open a screen of the app, or run one of the handler's writes (ADR 0007). */
export type WidgetAction =
  | Readonly<{ type: "open"; path: string }>
  | Readonly<{ type: "log_again"; entryId: string }>
  | Readonly<{ type: "log_set"; sessionId: string; exerciseId: string; setNumber: number }>
  | Readonly<{ type: "undo"; action: PendingUndo["action"]; rowId: string }>;

/** The routes the widgets open. The renderer puts the app's `keylow://` scheme in front of a path. */
export const WIDGET_PATHS = {
  app: "/",
  diary: "/diary",
  week: "/week",
  bodyMap: "/body-map",
  dashboard: "/dashboard",
  foods: "/foods",
  scan: "/foods/scan",
  quickAdd: "/foods/quick-add",
  weightEntry: "/more/weight/entry",
  recipes: "/more/recipes",
  session: "/session",
  targets: "/targets",
  train: "/train",
} as const;

export const openAction = (path: string): WidgetAction => ({ type: "open", path });

/**
 * The link that starts a session. It writes, so it carries the snapshot's nonce, which the app checks
 * before it starts anything (ADR 0007, "Deep links and the nonce rule").
 */
export const startSessionPath = (start: "planned" | "empty", nonce: string): string =>
  `${WIDGET_PATHS.session}?start=${start}&nonce=${encodeURIComponent(nonce)}`;
