import type { StatusBadgeProps } from "../Badge";

export type OptionCardSelection = "single" | "multiple";

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
  /**
   * `single` (the default) is a radio with a round mark at the start, and only one card of a group is chosen.
   * `multiple` is a checkbox with a square mark: any number of cards may be chosen, and the chosen card is
   * pressed again to clear it.
   */
  selection?: OptionCardSelection | undefined;
  /** Whether this is a chosen option. A radio card is the only one of its group that is. */
  checked: boolean;
  /**
   * Why the option is not offered, such as "Not offered under 18.". A card with a reason is disabled:
   * it does not respond, its radio and words are dimmed to 40 percent, and the reason is drawn at full
   * strength with an info icon and is read as part of the card's name.
   */
  disabledReason?: string | undefined;
  /** Called when the card is pressed. A chosen radio card does nothing, as a radio stays chosen. A chosen checkbox card calls it to clear. */
  onPress: () => void;
};

/**
 * One option of an `OptionCardGroup`: a card's own props, and the `id` the group hands on when it is chosen.
 * The id is not the card's `value`, which is the figure at the end of the card.
 */
export type OptionCardGroupOption<Id extends string> = Omit<
  OptionCardProps,
  "checked" | "onPress" | "selection"
> & {
  id: Id;
};

type OptionCardGroupSharedProps<Id extends string> = {
  /** The question the options answer, such as "What is your goal?". A screen reader reads it before the options. */
  label: string;
  options: readonly OptionCardGroupOption<Id>[];
};

/** Choose one of the options, as radio cards. */
export type OptionCardGroupSingleProps<Id extends string> = OptionCardGroupSharedProps<Id> & {
  selection?: "single" | undefined;
  /** The chosen option's id, or `undefined` when nothing is chosen yet. */
  value: Id | undefined;
  onChange: (id: Id) => void;
};

/** Choose any number of the options, as checkbox cards. */
export type OptionCardGroupMultipleProps<Id extends string> = OptionCardGroupSharedProps<Id> & {
  selection: "multiple";
  /** The chosen options' ids, in the order they were chosen. The screen keeps them. */
  value: readonly Id[];
  /** Hands on every chosen id after a card is pressed: the pressed id added at the end, or taken out. */
  onChange: (next: Id[]) => void;
};

export type OptionCardGroupProps<Id extends string> =
  OptionCardGroupSingleProps<Id> | OptionCardGroupMultipleProps<Id>;
