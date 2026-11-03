import { SIGNED_OUT_SOURCE } from "@keylow/core/widgets";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestWidgetUpdate } from "react-native-android-widget";

import { createAsyncStorageWidgetBridge } from "./asyncStorageWidgetBridge";
import { drawingFor, readDrawingInputs } from "./dashboardDrawing";
import { DASHBOARD_WIDGET_PROVIDERS } from "./widgetProviders";

import type { WidgetBridge } from "./types";
import type { RequestWidgetUpdateProps } from "react-native-android-widget";

type WidgetStorage = NonNullable<
  NonNullable<Parameters<typeof createAsyncStorageWidgetBridge>[0]>["storage"]
>;

type Options = Readonly<{
  storage?: WidgetStorage;
  requestUpdate?: (request: RequestWidgetUpdateProps) => Promise<void>;
  now?: () => Date;
}>;

/**
 * Set at sign-out and cleared by the next snapshot. It holds no data. It is how the widgets tell "the person
 * signed out" from "the app has not run yet", because with the snapshot deleted both read as no data.
 */
const SIGNED_OUT_STORAGE_KEY = "keylow.widgets.signedOut";

/**
 * The bridge on Android: the AsyncStorage bridge with a redraw that asks the launcher to update each of the
 * six dashboard widgets from what is stored, and a signed out state after `clear` (ADR 0007, "Privacy").
 */
export function createAndroidWidgetBridge({
  storage = AsyncStorage,
  requestUpdate = requestWidgetUpdate,
  now = () => new Date(),
}: Options = {}): WidgetBridge {
  const stored = createAsyncStorageWidgetBridge({ storage });

  const bridge: WidgetBridge = {
    ...stored,
    writeSnapshot: async (snapshot) => {
      await stored.writeSnapshot(snapshot);
      await storage.removeItem(SIGNED_OUT_STORAGE_KEY);
    },
    readSnapshot: async () => {
      const source = await stored.readSnapshot();
      if (source.status === "no_data" && (await storage.getItem(SIGNED_OUT_STORAGE_KEY)) !== null) {
        return SIGNED_OUT_SOURCE;
      }

      return source;
    },
    clear: async () => {
      await stored.clear();
      await storage.setItem(SIGNED_OUT_STORAGE_KEY, "1");
    },
    requestRedraw: async () => {
      const inputs = await readDrawingInputs(bridge);
      const at = now();
      await Promise.all(
        DASHBOARD_WIDGET_PROVIDERS.map(({ kind, name }) => {
          const drawing = drawingFor(inputs, kind, at);

          return drawing === null
            ? Promise.resolve()
            : requestUpdate({ widgetName: name, renderWidget: () => drawing });
        }),
      );
    },
  };

  return bridge;
}
