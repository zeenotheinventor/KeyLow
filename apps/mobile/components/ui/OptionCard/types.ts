import type { StatusBadgeProps } from "../Badge";

export type OptionCardProps = {
  /** The option's name, such as "Sedentary". It heads the card and is the first words of its accessible name. */
  title: string;
  /** One line of help under the title, in secondary caption text. It wraps and is never cut. */
  description?: string | undefined;
  /** A short status after the title, such as "Suggested". Its text comes after the title in the card's name. */
  badge?: StatusBadgeProps | undefined;
  /** A figure at the end of the card, such as "0.4 kg", with `valueCaption` muted under it. */
  value?: string | undefined;
  valueCaption?: string | undefined;
  /**
   * How a screen reader says the value, such as "about 0.4 kilograms a week". It takes the place of the
   * value and its caption in the card's name, for a figure whose written form is short.
   */
  valueLabel?: string | undefined;
  /** Whether this is the chosen option. The card is a radio, so only one card of a group is. */
  checked: boolean;
  /**
   * Why the option is not offered, such as "Not offered under 18.". A card with a reason is disabled:
   * it does not respond, its radio and words are dimmed to 40 percent, and the reason is drawn at full
   * strength with an info icon and is read as part of the card's name.
   */
  disabledReason?: string | undefined;
  /** Called when the card is pressed. Pressing the chosen card does nothing, as a radio stays chosen. */
  onPress: () => void;
};

/**
 * One option of an `OptionCardGroup`: a card's own props, and the `id` the group hands on when it is chosen.
 * The id is not the card's `value`, which is the figure at the end of the card.
 */
export type OptionCardGroupOption<Id extends string> = Omit<
  OptionCardProps,
  "checked" | "onPress"
> & {
  id: Id;
};

export type OptionCardGroupProps<Id extends string> = {
  /** The question the options answer, such as "What is your goal?". A screen reader reads it before the options. */
  label: string;
  options: readonly OptionCardGroupOption<Id>[];
  /** The chosen option's id, or `undefined` when nothing is chosen yet. */
  value: Id | undefined;
  onChange: (id: Id) => void;
};
