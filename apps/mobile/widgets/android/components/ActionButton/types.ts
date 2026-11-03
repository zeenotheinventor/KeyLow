import type { WidgetTheme } from "../../theme";
import type { WidgetButton } from "@keylow/core/widgets";

export type ActionButtonProps = Readonly<{
  button: WidgetButton;
  theme: WidgetTheme;
  /** Shares a row equally with the other buttons in it, or takes the width of its column. */
  fill?: "flex" | "width" | undefined;
  /** 36 points on most widgets, 40 on the Training widget's start buttons. */
  height?: number;
}>;
