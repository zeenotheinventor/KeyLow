import type { WidgetColour } from "../../theme";
import type { WidgetIcon } from "@keylow/core/widgets";

/** The icons core names for the buttons, and the two the widgets draw themselves. */
export type WidgetIconName = WidgetIcon | "offline" | "alert";

export type IconProps = Readonly<{
  name: WidgetIconName;
  colour: WidgetColour;
  size: number;
  /** The stroke the board draws: 2 for most icons, 2.5 for the plus and the tick on a button. */
  strokeWidth?: number;
}>;
