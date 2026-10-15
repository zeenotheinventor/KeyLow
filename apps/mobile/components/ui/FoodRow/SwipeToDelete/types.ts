import type { ReactNode } from "react";

export type SwipeToDeleteProps = {
  /** The row that slides left to show the action. It must have a fill of its own. */
  children: ReactNode;
  /** Called at once when the action is pressed, with no confirmation. */
  onDelete: () => void;
  /** Draws the row already swiped, as the swiped board does. */
  startsSwiped?: boolean | undefined;
  /**
   * Makes the row controlled: it is open while this is true. A screen that keeps at most one row open,
   * and closes them when the list scrolls, sets this on every row. Leave it out and the row looks
   * after itself. The row still slides on a swipe and reports it in `onOpenChange`, so the screen
   * is expected to follow.
   */
  isOpen?: boolean | undefined;
  /** Called when a swipe, a tap on the open row or the Delete action opens or closes the row. Not called when `isOpen` changes it. */
  onOpenChange?: ((isOpen: boolean) => void) | undefined;
};
