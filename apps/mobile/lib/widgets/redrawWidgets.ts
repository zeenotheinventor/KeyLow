import { requestWidgetUpdate } from "react-native-android-widget";

import { drawingFor, readDrawingInputs } from "./widgetDrawing";
import { WIDGET_PROVIDERS } from "./widgetProviders";

import type { WidgetBridge } from "./types";
import type { WidgetFailure, WidgetKind } from "@keylow/core/widgets";
import type { RequestWidgetUpdateProps } from "react-native-android-widget";

type Options = Readonly<{
  bridge: WidgetBridge;
  now?: () => Date;
  requestUpdate?: (request: RequestWidgetUpdateProps) => Promise<void>;
  /**
   * What a tap that did not write failed with, and the kind of the widget that was tapped. Only that kind
   * shows it, and only for this one redraw: it is never stored, so the next redraw of any kind (the app's
   * snapshot write, the next tap, the provider's periodic update) draws the widget normally again.
   */
  failure?: Readonly<{ kind: WidgetKind; failure: WidgetFailure }> | undefined;
}>;

/** Asks the launcher to update all eleven widgets from what is stored. */
export async function redrawWidgets({
  bridge,
  now = () => new Date(),
  requestUpdate = requestWidgetUpdate,
  failure,
}: Options): Promise<void> {
  const inputs = await readDrawingInputs(bridge);
  const at = now();
  await Promise.all(
    WIDGET_PROVIDERS.map(({ kind, name }) => {
      const drawing = drawingFor(inputs, kind, at, failure?.kind === kind ? failure.failure : null);

      return requestUpdate({ widgetName: name, renderWidget: () => drawing });
    }),
  );
}
