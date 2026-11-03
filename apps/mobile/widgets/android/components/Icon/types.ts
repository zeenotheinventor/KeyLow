import type { WidgetColour } from "../../theme";

export type WidgetIconName = "chevron" | "offline";

export type IconProps = Readonly<{
  name: WidgetIconName;
  colour: WidgetColour;
  size: number;
}>;
