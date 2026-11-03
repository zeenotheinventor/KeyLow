import type { WidgetTheme } from "../../theme";
import type { WidgetAction } from "@keylow/core/widgets";
import type { ReactNode } from "react";
import type { FlexWidgetStyle } from "react-native-android-widget";

export type WidgetCardProps = Readonly<{
  theme: WidgetTheme;
  /** What a tap on the card outside a button does. */
  tap?: WidgetAction;
  /** The name a screen reader reads for the card. */
  accessibleName?: string;
  paddingVertical?: number;
  paddingHorizontal?: number;
  direction?: "column" | "row";
  justifyContent?: FlexWidgetStyle["justifyContent"];
  alignItems?: FlexWidgetStyle["alignItems"];
  children: ReactNode;
}>;
