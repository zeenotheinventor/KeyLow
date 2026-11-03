import type { WidgetTheme } from "../../theme";
import type { HeatRowView } from "@keylow/core/widgets";

export type HeatRowsProps = Readonly<{
  rows: readonly HeatRowView[];
  theme: WidgetTheme;
}>;
