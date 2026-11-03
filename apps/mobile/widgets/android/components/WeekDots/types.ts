import type { WidgetTheme } from "../../theme";
import type { WeekDotView } from "@keylow/core/widgets";

export type WeekDotsProps = Readonly<{
  dots: readonly WeekDotView[];
  theme: WidgetTheme;
  /** Labelled is the This week widget's seven columns, compact is the row of small dots on the large widget. */
  variant: "labelled" | "compact";
}>;
