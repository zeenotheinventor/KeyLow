import { widgetViewModel } from "@keylow/core/widgets";

import { widgetRepresentation } from "../../widgets/android";

import type { WidgetBridge } from "./types";
import type { PendingUndo, WidgetFailure, WidgetKind, WidgetSource } from "@keylow/core/widgets";
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

/**
 * The light and dark drawing of one widget kind at `now`, built by core and laid out by the Android layouts.
 * A failure is only for the redraw that follows a tap that did not write, and is never stored.
 */
export const drawingFor = (
  { source, pendingUndo }: DrawingInputs,
  kind: WidgetKind,
  now: Date,
  failure: WidgetFailure | null = null,
): WidgetRepresentation =>
  widgetRepresentation(widgetViewModel(source, kind, now, { pendingUndo, failure }));
