import type { HapticFeedbackName } from "../../../lib/haptics";
import type { IconName, IconSizeName } from "../Icon";

export type IconButtonVariant = "secondary" | "ghost";

/** Medium is a 44 point square. Small is a 36 point square that still reaches a 44 point touch target. */
export type IconButtonSize = "md" | "sm";

export type IconButtonProps = {
  icon: IconName;
  /**
   * The size of the icon: a size token, or a size in points for a glyph the frames draw off the scale.
   * A button draws it at `md`, 20 points, unless it is asked for another.
   */
  iconSize?: IconSizeName | number;
  /** What the button does, as a short sentence case name. It is the button's accessible name. */
  label: string;
  /** Defaults to `secondary`. */
  variant?: IconButtonVariant;
  /** Defaults to `md`. */
  size?: IconButtonSize;
  /** Dims the button to 40 percent and stops it responding, with no motion. */
  disabled?: boolean;
  /** The haptic token to play when pressed. The design gives none of its own. */
  haptic?: HapticFeedbackName;
  onPress?: () => void;
  /** Layout from the caller, such as alignment and margins. */
  className?: string;
};
