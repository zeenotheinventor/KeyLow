import type { IconName } from "../Icon";

export type ListRowProps = {
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
  /** A row without it goes nowhere: it is drawn as plain information, with no press feedback. */
  onPress?: (() => void) | undefined;
  /** Dims the row to half and stops it responding. */
  disabled?: boolean | undefined;
};
