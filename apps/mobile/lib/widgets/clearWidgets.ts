import { defaultWidgetBridge } from "./defaultWidgetBridge";

import type { WidgetBridge } from "./types";

/**
 * Deletes the snapshot and the pending-undo record and asks for a redraw, so the widgets show the signed out
 * state and nothing from the last account stays on the home screen (ADR 0007, "Privacy").
 */
export async function clearWidgets(bridge: WidgetBridge = defaultWidgetBridge): Promise<void> {
  await bridge.clear();
  await bridge.requestRedraw();
}
