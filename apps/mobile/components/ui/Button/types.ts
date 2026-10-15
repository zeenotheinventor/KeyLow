import type { HapticFeedbackName } from "../../../lib/haptics";
import type { IconName } from "../Icon";
import type { ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

/**
 * Small is 36 points, for a minor action drawn inside a card, such as removing a portion. It reaches the
 * 44 point touch target through its hit slop. Medium is 44 and large is 52.
 */
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  /** The label: short, sentence case, no full stop. */
  children: string;
  /** Primary for the one main action on a view, secondary for everything else. Defaults to `primary`. */
  variant?: ButtonVariant;
  /** Defaults to `md`. */
  size?: ButtonSize;
  /**
   * Ghost only: writes the label and icon in the secondary text colour, for a minor action beside the
   * main content, such as removing a portion. Every other variant keeps its own colour.
   */
  quiet?: boolean;
  /**
   * Ghost only: `danger` writes the label and icon in the danger colour on the plain background, with no
   * fill and no visible border, for a destructive action that sits under the main one, such as Delete under
   * Save. The filled `destructive` variant stays for an action that is the point of the view. Every other
   * variant keeps its own colour. Ghost only: `accent-ink` writes the label and icon in the design's
   * `--accent-ink`, lime in dark and the primary text colour in light, where lime is too faint for text,
   * for a link-like action inside a card, such as Edit beside a target.
   */
  tone?: "danger" | "accent-ink";
  /** Dims the button to 40 percent and stops it responding, with no motion. */
  disabled?: boolean;
  /** Keeps the label's width, hides it and shows a spinner. The button stops responding. */
  loading?: boolean;
  fullWidth?: boolean;
  /**
   * Names the button for a screen reader in place of its label, for a button whose label does not tell it
   * apart from another, such as each portion's Remove. It starts with the label drawn, so the name
   * contains what is on the button.
   */
  accessibilityLabel?: string;
  /** A leading icon, by name. It is decoration. */
  icon?: IconName | undefined;
  /**
   * A leading mark that is not one of the icon map's, such as the Google "G" of the sign in boards, with
   * the 12 points between it and the label that those boards draw. It takes the place of `icon`. The
   * caller hides it from screen readers, because the label names the button.
   */
  leading?: ReactNode;
  /**
   * The haptic token to play when pressed. The design gives a button none of its own: a screen asks
   * for one where the design says so (`select` for a step, `confirm` for a save).
   */
  haptic?: HapticFeedbackName;
  onPress?: () => void;
  /** Layout from the caller, such as alignment and margins. */
  className?: string;
};
