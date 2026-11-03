import { Platform } from "react-native";

import { createAndroidWidgetBridge } from "./androidWidgetBridge";
import { createAsyncStorageWidgetBridge } from "./asyncStorageWidgetBridge";

import type { WidgetBridge } from "./types";

/** The Android bridge redraws the widgets. Anywhere else there are no widgets, so a redraw does nothing. */
export const createDefaultWidgetBridge = (platform: string): WidgetBridge =>
  platform === "android" ? createAndroidWidgetBridge() : createAsyncStorageWidgetBridge();

/** The bridge the app and the task handler share. */
export const defaultWidgetBridge = createDefaultWidgetBridge(Platform.OS);
