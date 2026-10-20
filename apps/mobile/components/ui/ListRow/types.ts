import type { IconName } from "../Icon";
import type { ReactNode, Ref } from "react";
import type { View } from "react-native";

type ListRowBaseProps = {
  /** A leading icon, by name, in a small tile. */
  icon?: IconName | undefined;
  title: string;
  subtitle?: string | undefined;
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
