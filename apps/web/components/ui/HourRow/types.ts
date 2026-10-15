import type { ReactNode, Ref } from "react";

export type HourRowProps = {
  /** The hour of the day, 0 to 23. `onAdd` is called with it. */
  hour: number;
  /** The hour's label as core writes it, such as "08:00". It is the chip's text and part of the names. */
  label: string;
  /** How many foods are logged in the hour. It names the group ("08:00, 2 foods") and decides whether the card is drawn. */
  foodCount: number;
  /** The current hour: its chip carries an accent dot named "Current hour". Defaults to false. */
  isNow?: boolean;
  /** The row's element, so the screen can scroll an hour into view. */
  ref?: Ref<HTMLDivElement> | undefined;
  /** Dims the plus and stops it responding, such as while offline. The row and its foods are left alone. Defaults to false. */
  addDisabled?: boolean | undefined;
  /** Called with the hour when the plus is pressed. Leave it out when there is nowhere to add yet, and no plus is drawn. */
  onAdd?: ((hour: number) => void) | undefined;
  /**
   * The hour's foods, which the card holds under the chip: at the wide width a `FoodTable` of
   * table rows, at the narrow width a list of stacked rows. Not drawn when `foodCount` is 0.
   */
  children?: ReactNode;
};
