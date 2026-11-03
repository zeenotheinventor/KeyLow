import type { WidgetTheme } from "../../theme";
import type { BodyMapViewModel } from "@keylow/core/widgets";

export type HeatLegendProps = Readonly<{
  legend: BodyMapViewModel["legend"];
  theme: WidgetTheme;
}>;
