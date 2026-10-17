import type { HapticFeedbackName } from "../../../lib/haptics";
import type { IconName, IconSizeName } from "../Icon";

/**
 * The ring is the quiet plus on a food row: a 32 point circle with a border and no fill, the icon in the
 * secondary text colour, reached out to a 44 point touch target. It has the one shape, so the size does not
 * change it.
 */
export type IconButtonVariant = "secondary" | "ghost" | "ring";

/** Medium is a 44 point square. Small is a 36 point square that still reaches a 44 point touch target. */
export type IconButtonSize = "md" | "sm";

/** The text tones a glyph can be drawn in. */
export type IconButtonTone = "primary" | "secondary";

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
  /**
   * The colour of the glyph: primary text, or secondary text for a quiet control such as the X on an
   * ingredient row. The ring is always secondary. Defaults to `primary`.
   */
  tone?: IconButtonTone;
  /** Dims the button to 40 percent and stops it responding, with no motion. */
  disabled?: boolean;
  /**
   * Whether a disabled button dims itself to 40 percent. Defaults to true. A button inside something that
   * is already dimmed as a whole, such as the offline search bar, turns it off, so it is dimmed once.
   */
  dimsWhenDisabled?: boolean;
  /** The haptic token to play when pressed. The design gives none of its own. */
  haptic?: HapticFeedbackName;
  onPress?: (() => void) | undefined;
  /** Layout from the caller, such as alignment and margins. */
  className?: string;
};
