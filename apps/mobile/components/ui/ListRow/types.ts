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
   * `danger` draws the title in the danger colour, for a row that throws something away, such as Delete all
   * conversations. `secondary` mutes it, for a row that is done with, such as an undone change. `accent` draws
   * it in the accent ink, for a row that opens more or goes on, such as the palate's "Show all 10".
   */
  titleTone?: "primary" | "danger" | "secondary" | "accent" | undefined;
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
  /**
   * `snug` is the palate lists' row: a 56 point minimum height where a row with a trailing action is 60, and a
   * title that wraps to as many lines as it needs where it is usually cut to one. Leave it out for the usual row.
   */
  density?: "snug" | undefined;
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
   * A glyph that takes the chevron's place at the end of the row, for a row that does something other than
   * navigate, such as the assistant's starters, which draw an arrow up for "send this". It is drawn small and
   * muted like the chevron, and `chevron` does not turn it off. Only a row with `onPress` has one.
   */
  trailingIcon?: IconName | undefined;
  /**
   * `footer` is the row that closes a card of rows with an action, such as the recipe editor's Add ingredient:
   * its icon bare and not in a tile, a 52 point row, no subtitle and no chevron. Leave it out for the usual row.
   */
  variant?: "footer" | undefined;
  /** What a screen reader announces the row as. A row that goes to another screen, such as the palate's Foods to avoid, is a `link`. Defaults to `button`. */
  role?: "link" | undefined;
  /** The row's button, so a screen can move a screen reader's focus to it. */
  ref?: Ref<View> | undefined;
  toggle?: undefined;
  trailing?: undefined;
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
  trailingIcon?: undefined;
  variant?: undefined;
  role?: undefined;
  ref?: undefined;
  toggle?: undefined;
  trailing?: undefined;
  children?: ReactNode;
};

export type ListRowToggle = {
  isOn: boolean;
  /** The switch's accessible name, such as "Use the assistant". */
  label: string;
  onValueChange: (isOn: boolean) => void;
  /** Dims the switch and stops it responding, while the choice is being saved. */
  disabled?: boolean | undefined;
};

/**
 * A row with the kit's `Switch` at the end, as the Assistant settings board draws "Use the assistant". The row
 * itself goes nowhere and has no chevron, and the switch is the one control, named by `toggle.label`, so the
 * row is not folded into one button and a screen reader reaches the switch. The visible title and subtitle are
 * hidden from a screen reader, so `toggle.label` says all of it.
 */
export type ListRowWithToggleProps = ListRowBaseProps & {
  toggle: ListRowToggle;
  onPress?: undefined;
  loading?: undefined;
  trailingIcon?: undefined;
  variant?: undefined;
  role?: undefined;
  ref?: undefined;
  trailing?: undefined;
  children?: undefined;
};

/**
 * What a row of the changes list draws after its words. `action` is a text button in the accent ink, as the
 * assistant's cards draw their Undo, named for its row, `busy` while it runs. `label` is plain muted words,
 * such as "Undone" or "Can't undo", read as part of the row's one name. `tick` is a success tick for a state
 * that is done, such as the export file's "Ready" or "Saved": it has the name `label` of its own, and the words
 * on the left are named without it.
 */
export type ListRowTrailing =
  | {
      kind: "action";
      label: string;
      onPress: () => void;
      busy?: boolean | undefined;
      /** The button's accessible name, when "{label}, {title}" is not the one wanted, such as "Not true: Eggs". */
      accessibleName?: string | undefined;
    }
  | { kind: "label"; label: string }
  | { kind: "tick"; label: string };

/**
 * A row that goes nowhere, with an action or a label at the end, as `assistant-settings · changes` draws
 * its rows. With an action the words on the left are one named group and the button is its own stop.
 */
export type ListRowWithTrailingProps = ListRowBaseProps & {
  trailing: ListRowTrailing;
  onPress?: undefined;
  loading?: undefined;
  trailingIcon?: undefined;
  variant?: undefined;
  role?: undefined;
  ref?: undefined;
  toggle?: undefined;
  children?: undefined;
};

export type ListRowProps =
  ListRowToPressProps | ListRowWithControlProps | ListRowWithToggleProps | ListRowWithTrailingProps;
