import type { BadgeTone } from "../Badge";
import type { IconName } from "../Icon";
import type { FieldMacro } from "../Input";
import type { ReactNode, Ref } from "react";
import type { View } from "react-native";

/** The three macros `NumericInput`'s `macro` draws, and calories, which the diary's progress strip colours too. */
export type ListRowMacro = FieldMacro | "calories";

export type ListRowBadge = {
  /** One short phrase from `@keylow/core/copy`. */
  label: string;
  tone: BadgeTone;
};

type ListRowBaseProps = {
  /** A leading icon, by name, in a small tile. */
  icon?: IconName | undefined;
  title: string;
  /**
   * Draws the macro's (or the calories') colour as an 8 point key before the title, as the Targets screen's Protein, Carbohydrate
   * and Fat rows do. It is decoration, so the row's accessible name is unchanged.
   */
  macro?: ListRowMacro | undefined;
  subtitle?: string | undefined;
  /**
   * A short status drawn before the value, such as the weigh-in list's "Left out of trend" in the warning
   * tone. Its label is added to the row's accessible name, after the subtitle and before the value.
   */
  badge?: ListRowBadge | undefined;
  /** The trailing value, already formatted: write it with `@keylow/core/format`. */
  value?: string | undefined;
  /** The unit after the value, such as `kcal`. */
  unit?: string | undefined;
  /**
   * How the value is drawn. `numeral`, the default, is a small semibold numeral, for a figure such as an
   * amount. `quiet` is secondary body text, for a count beside a title, as the recipe library's Archived
   * recipes row draws it.
   */
  valueLook?: "numeral" | "quiet" | undefined;
  /**
   * `compact` is the weigh-in list's row as `weight: chart and weigh-ins` draws it: 52 points tall, a 32 point
   * tile with an 18 point icon, a 14 over 20 semibold title over a 12 over 16 muted caption with no gap between
   * them, and a 16 over 24 semibold value that the unit is drawn with in one piece. The subtitle may wrap to a
   * second line. Leave it out for the usual row.
   */
  size?: "compact" | undefined;
  /** `muted` draws the value and the unit in the muted text colour, as the weigh-in the trend left out. */
  valueTone?: "muted" | undefined;
  /** Whether the chevron that says the row navigates is drawn. Only a row with `onPress` has one. Defaults to true. */
  chevron?: boolean | undefined;
  /** Dims the row to half and stops it responding. */
  disabled?: boolean | undefined;
};

/** A row that is information, or that goes somewhere when pressed. */
export type ListRowToPressProps = ListRowBaseProps & {
  /** A row without it goes nowhere: it is drawn as plain information, with no press feedback. */
  onPress?: (() => void) | undefined;
  /**
   * Marks the row busy while what pressing it started is under way: the row stops responding and a spinner
   * takes the chevron's place. Unlike `disabled` it does not dim the row. No board draws it (KEY-505).
   */
  loading?: boolean | undefined;
  /**
   * `footer` is the row that closes a card of rows with an action, such as the recipe editor's Add ingredient:
   * its icon bare and not in a tile, a 52 point row, no subtitle and no chevron. Leave it out for the usual row.
   */
  variant?: "footer" | undefined;
  /** The row's button, so a screen can move a screen reader's focus to it. */
  ref?: Ref<View> | undefined;
  children?: undefined;
};

/**
 * A row with a control drawn under its title row, such as the Appearance setting's `SegmentedControl`. It goes
 * nowhere, so the type takes no `onPress` beside the control. A control that is `null`, `undefined` or `false`,
 * as a conditional one can be, leaves a plain row. Otherwise the title row loses its minimum height to the 12
 * points of padding the control sits in.
 */
export type ListRowWithControlProps = ListRowBaseProps & {
  onPress?: undefined;
  loading?: undefined;
  variant?: undefined;
  ref?: undefined;
  children?: ReactNode;
};

export type ListRowProps = ListRowToPressProps | ListRowWithControlProps;
