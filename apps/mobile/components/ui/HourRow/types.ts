import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";

export type HourRowProps = {
  /** The hour of the day, 0 to 23. `onAdd` is called with it. */
  hour: number;
  /** The hour's label as core writes it, such as "08:00". It is the chip's text and part of the names. */
  label: string;
  /** The current hour: its chip carries an accent dot and is named "11:00, now". Defaults to false. */
  isNow?: boolean;
  /** Dims the plus to 40 percent and stops it responding, such as while offline. The foods stay readable. Defaults to false. */
  addDisabled?: boolean;
  /** Called with the hour when the plus is pressed. */
  onAdd: (hour: number) => void;
  /**
   * Called with the row's measured layout, so the screen can work out where an hour starts to scroll to
   * it. An hour with foods is taller than 44 points, so its height is only known once it is drawn.
   */
  onLayout?: (event: LayoutChangeEvent) => void;
  /** The foods logged in this hour, one `FoodRow` in the diary layout for each. An hour with none draws no card. */
  children?: ReactNode;
};
