import type { IconName } from "../Icon";
import type { ReactNode } from "react";

type ListRowBaseProps = {
  /** A leading icon, by name, in a small tile. */
  icon?: IconName | undefined;
  title: string;
  subtitle?: string | undefined;
  /** The trailing value, already formatted: write it with `@keylow/core/format`. */
  value?: string | undefined;
  /** The unit after the value, such as `kcal`. */
  unit?: string | undefined;
  /** Whether the chevron that says the row navigates is drawn. Only a row with `onPress` has one. Defaults to true. */
  chevron?: boolean | undefined;
  /** Dims the row to half and stops it responding. */
  disabled?: boolean | undefined;
};

/** A row that is information, or that goes somewhere when pressed. */
export type ListRowToPressProps = ListRowBaseProps & {
  /** A row without it goes nowhere: it is drawn as plain information, with no press feedback. */
  onPress?: (() => void) | undefined;
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
  children?: ReactNode;
};

export type ListRowProps = ListRowToPressProps | ListRowWithControlProps;
