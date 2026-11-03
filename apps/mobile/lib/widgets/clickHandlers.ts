import type { WidgetTaskHandlerProps } from "react-native-android-widget";

/** Runs one named click action of a widget (a one-tap write) inside the task handler. */
export type WidgetClickHandler = (props: WidgetTaskHandlerProps) => Promise<void>;

/**
 * The click actions the task handler runs, by the name the layout gave them. The one-tap widgets (KEY-806)
 * add their entries here. Opening a screen is not one of them, because the launcher handles `OPEN_URI`.
 */
export const WIDGET_CLICK_HANDLERS: ReadonlyMap<string, WidgetClickHandler> = new Map();
