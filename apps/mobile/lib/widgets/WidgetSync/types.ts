import type { WidgetBridge } from "../types";

export type WidgetSyncProps = Readonly<{
  /** Where the snapshot is stored. The app's bridge unless a test gives another. */
  bridge?: WidgetBridge;
  /** How long the data must stay unchanged before the snapshot is written. */
  debounceMilliseconds?: number;
}>;
