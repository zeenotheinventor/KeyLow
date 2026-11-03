import type { WidgetTheme } from "../../theme";
import type { MacroRowView } from "@keylow/core/widgets";

export type MacroRowsProps = Readonly<{
  macros: readonly MacroRowView[];
  theme: WidgetTheme;
  /** The space between one macro and the next. */
  gap: number;
}>;
