import type { WidgetTheme } from "../../theme";
import type { WidgetColourRole } from "@keylow/core/widgets";

export type WidgetTextWeight = "regular" | "medium" | "semiBold";

export type WidgetTextProps = Readonly<{
  text: string;
  theme: WidgetTheme;
  role?: WidgetColourRole;
  size?: number;
  weight?: WidgetTextWeight;
  align?: "left" | "center" | "right";
  /** Takes the width of its parent, which centring or right alignment needs. */
  isFullWidth?: boolean;
}>;
