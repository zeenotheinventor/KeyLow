import { WIDGET_CLICK_HANDLERS } from "./clickHandlers";
import { drawingFor, readDrawingInputs } from "./dashboardDrawing";
import { defaultWidgetBridge } from "./defaultWidgetBridge";
import { dashboardKindOf } from "./widgetProviders";

import type { WidgetClickHandler } from "./clickHandlers";
import type { WidgetBridge } from "./types";
import type { WidgetTaskHandler, WidgetTaskHandlerProps } from "react-native-android-widget";

type Dependencies = Readonly<{
  bridge: WidgetBridge;
  now: () => Date;
  clickHandlers?: ReadonlyMap<string, WidgetClickHandler>;
}>;

/**
 * The function the launcher runs, headless, when a widget is added, updated, resized or tapped (ADR 0007).
 * An add, update or resize draws the stored snapshot for the time it runs, so a widget that has sat all day
 * shows the new day's state without the app. A named click goes to its handler, and a click nobody handles
 * does nothing.
 */
export function createWidgetTaskHandler({
  bridge,
  now,
  clickHandlers = WIDGET_CLICK_HANDLERS,
}: Dependencies): WidgetTaskHandler {
  const draw = async ({ widgetInfo, renderWidget }: WidgetTaskHandlerProps): Promise<void> => {
    const kind = dashboardKindOf(widgetInfo.widgetName);
    if (kind === undefined) {
      return;
    }
    const drawing = drawingFor(await readDrawingInputs(bridge), kind, now());
    if (drawing !== null) {
      renderWidget(drawing);
    }
  };

  return async (props) => {
    switch (props.widgetAction) {
      case "WIDGET_ADDED":
      case "WIDGET_UPDATE":
      case "WIDGET_RESIZED":
        await draw(props);
        return;
      case "WIDGET_CLICK":
        await clickHandlers.get(props.clickAction ?? "")?.(props);
        return;
      default:
        return;
    }
  };
}

export const widgetTaskHandler = createWidgetTaskHandler({
  bridge: defaultWidgetBridge,
  now: () => new Date(),
});
