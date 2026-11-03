import type { WidgetAction } from "@keylow/core/widgets";
import type { ClickActionProps } from "react-native-android-widget";

/** `/diary` becomes `keylow://diary`, the form of the app's other links, such as `keylow://auth/callback`. */
export const widgetUri = (path: string): string => `keylow://${path.replace(/^\//, "")}`;

type WidgetClick = Pick<ClickActionProps, "clickAction" | "clickActionData">;

/**
 * What a tap does. An open action is the library's `OPEN_URI`, which the launcher handles without the app's
 * JS. The actions that write run in the task handler as named click actions, and their data is only the ids
 * the handler needs to find the row or the set. No name, load, amount or weight goes in a click, because the
 * data passes through the launcher. Undo carries nothing, since the handler reads its stored record.
 */
export const clickPropsFor = (action: WidgetAction): WidgetClick => {
  switch (action.type) {
    case "open":
      return { clickAction: "OPEN_URI", clickActionData: { uri: widgetUri(action.path) } };
    case "log_again":
      return { clickAction: "LOG_AGAIN", clickActionData: { entryId: action.entryId } };
    case "log_set":
      return {
        clickAction: "LOG_SET",
        clickActionData: {
          sessionId: action.sessionId,
          exerciseId: action.exerciseId,
          setNumber: action.setNumber,
        },
      };
    case "undo":
      return { clickAction: "UNDO", clickActionData: {} };
  }
};
