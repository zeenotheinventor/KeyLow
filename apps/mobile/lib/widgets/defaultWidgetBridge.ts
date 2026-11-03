import { createAsyncStorageWidgetBridge } from "./asyncStorageWidgetBridge";

/** The bridge the app and a future task handler share. Its redraw does nothing until KEY-805 gives one. */
export const defaultWidgetBridge = createAsyncStorageWidgetBridge();
