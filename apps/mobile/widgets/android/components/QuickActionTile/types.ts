import type { WidgetTheme } from "../../theme";
import type { WidgetButton } from "@keylow/core/widgets";

export type QuickActionTileProps = Readonly<{
  button: WidgetButton;
  theme: WidgetTheme;
  /** 22 points on the small grid, 20 on the medium one. */
  iconSize: number;
}>;
