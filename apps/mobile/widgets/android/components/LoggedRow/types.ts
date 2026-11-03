import type { WidgetTheme } from "../../theme";
import type { WidgetAction } from "@keylow/core/widgets";

export type LoggedRowProps = Readonly<{
  /** "Logged Overnight oats", or "Logged". */
  text: string;
  undoLabel: string;
  /** What the Undo tap does. */
  action: WidgetAction;
  theme: WidgetTheme;
  height: number;
}>;
