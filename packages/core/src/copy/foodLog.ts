/** The name of the dot on the current hour's chip. */
export const CURRENT_HOUR_LABEL = "Current hour";

/** The name of the card that holds an hour's foods, such as "Foods at 08:00". */
export const describeFoodsAtHour = (hourLabel: string): string => `Foods at ${hourLabel}`;

/** The label on the toast action that takes back a delete or a copy. */
export const UNDO_LABEL = "Undo";

/** The diary's Day and Week control: its name and its two options. */
export const DIARY_VIEW = { label: "View", day: "Day", week: "Week" } as const;

/** What a screen reader hears while the diary loads. */
export const DIARY_LOADING_LABEL = "Loading your diary";
