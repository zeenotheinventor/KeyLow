import type { HapticFeedbackName } from "../../../lib/haptics";
import type { IconName } from "../Icon";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

/** The design's `sm` (36) is for the dense web layout only, so mobile has medium (44) and large (52). */
export type ButtonSize = "md" | "lg";

export type ButtonProps = {
  /** The label: short, sentence case, no full stop. */
  children: string;
  /** Primary for the one main action on a view, secondary for everything else. Defaults to `primary`. */
  variant?: ButtonVariant;
  /** Defaults to `md`. */
  size?: ButtonSize;
  /** Dims the button to 40 percent and stops it responding, with no motion. */
  disabled?: boolean;
  /** Keeps the label's width, hides it and shows a spinner. The button stops responding. */
  loading?: boolean;
  fullWidth?: boolean;
  /** A leading icon, by name. It is decoration. */
  icon?: IconName | undefined;
  /**
   * The haptic token to play when pressed. The design gives a button none of its own: a screen asks
   * for one where the design says so (`select` for a step, `confirm` for a save).
   */
  haptic?: HapticFeedbackName;
  onPress?: () => void;
  /** Layout from the caller, such as alignment and margins. */
  className?: string;
};
