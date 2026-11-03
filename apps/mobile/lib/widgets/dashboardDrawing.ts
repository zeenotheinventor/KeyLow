import { widgetViewModel } from "@keylow/core/widgets";

import { widgetRepresentation } from "../../widgets/android";

import type { WidgetBridge } from "./types";
import type { DashboardWidgetKind } from "./widgetProviders";
import type { PendingUndo, WidgetSource } from "@keylow/core/widgets";
import type { WidgetRepresentation } from "react-native-android-widget";

/** What a drawing is built from: the stored snapshot (or the state that stands in for it) and the undo record. */
export type DrawingInputs = Readonly<{ source: WidgetSource; pendingUndo: PendingUndo | null }>;

export const readDrawingInputs = async (bridge: WidgetBridge): Promise<DrawingInputs> => {
  const [source, pendingUndo] = await Promise.all([
    bridge.readSnapshot(),
    bridge.readPendingUndo(),
  ]);

  return { source, pendingUndo };
};

/** The light and dark drawing of one widget kind at `now`, built by core and laid out by the Android layouts. */
export const drawingFor = (
  { source, pendingUndo }: DrawingInputs,
  kind: DashboardWidgetKind,
  now: Date,
): WidgetRepresentation | null =>
  widgetRepresentation(widgetViewModel(source, kind, now, { pendingUndo }));
