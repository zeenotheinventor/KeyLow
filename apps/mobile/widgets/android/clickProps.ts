import type { WidgetAction } from "@keylow/core/widgets";
import type { ClickActionProps } from "react-native-android-widget";

/** `/diary` becomes `keylow://diary`, the form of the app's other links, such as `keylow://auth/callback`. */
export const widgetUri = (path: string): string => `keylow://${path.replace(/^\//, "")}`;

type WidgetClick = Pick<ClickActionProps, "clickAction" | "clickActionData">;

/**
 * What a tap does. An open action is the library's `OPEN_URI`, which the launcher handles without the
 * app's JS. The actions that write (Log again, Log set, Undo) run in the task handler as named click
 * actions, and the one-tap widgets add their cases here, so for now they are not wired.
 */
export const clickPropsFor = (action: WidgetAction): WidgetClick => {
  switch (action.type) {
    case "open":
      return { clickAction: "OPEN_URI", clickActionData: { uri: widgetUri(action.path) } };
    default:
      return {};
  }
};
