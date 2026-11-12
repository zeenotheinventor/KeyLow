import type { Ref } from "react";

export type LogPlateButtonProps = {
  /** How many foods are on the plate: it says "Log food" for one and "Log foods" for more. */
  count: number;
  /** Whether a press logs the plate: online, a valid amount on every row, the zone known, and not logging. */
  canLog: boolean;
  /** The plate is being written: the spinner shows at full strength. */
  isLogging: boolean;
  onPress: () => void;
  /** Reaches the button, so focus can come back to it after a failed log. */
  buttonRef?: Ref<HTMLButtonElement> | undefined;
};
