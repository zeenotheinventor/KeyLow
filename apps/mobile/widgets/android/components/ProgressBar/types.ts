import type { WidgetTheme } from "../../theme";
import type { WidgetColourRole } from "@keylow/core/widgets";

export type ProgressBarProps = Readonly<{
  /** How much of the bar is filled, from 0 to 1. */
  fraction: number;
  fillRole: WidgetColourRole;
  trackRole: WidgetColourRole;
  theme: WidgetTheme;
}>;
