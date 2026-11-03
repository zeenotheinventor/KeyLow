/** The version of the snapshot the app writes and the widgets read. A snapshot of any other version is not read. */
export const WIDGET_SNAPSHOT_VERSION = 1;

/** How long a one-tap log can be undone from the widget, counted from the time the pending-undo record stores. */
export const UNDO_WINDOW_MINUTES = 10;

/** The spacing of the timeline's entries as the heat decays. */
export const TIMELINE_STEP_MINUTES = 60;

/** The recent foods the Log again widget lists, and so the most a snapshot holds. */
export const RECENT_FOODS_LIMIT = 3;

/** The warmest muscles the heat rows list. */
export const WARMEST_MUSCLES_SHOWN = 3;

/** The exercises the Training widget names before it says how many more there are. */
export const EXERCISE_NAMES_LIMIT = 3;

/** Every widget kind of boards A and B, in the order the boards draw them. */
export const WIDGET_KINDS = [
  "today_ring",
  "today_macros",
  "this_week",
  "body_heat",
  "today_glance",
  "body_map",
  "log_grid",
  "today_logging",
  "log_again",
  "weigh_in",
  "training",
] as const;

export type WidgetKind = (typeof WIDGET_KINDS)[number];

export const MILLISECONDS_PER_MINUTE = 60_000;
