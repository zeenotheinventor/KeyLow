import type { BadgeTone } from "@/components/ui/Badge";
import type { ComponentType, MouseEvent } from "react";

/** What the row needs of an icon: the props it sets. A `lucide-react` icon fits. */
export type ListRowIcon = ComponentType<{
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}>;

/** The four figures a macro key can colour: the calories and the three macros. */
export type ListRowMacro = "calories" | "protein" | "carbs" | "fat";

type ListRowContent = {
  /** A leading icon, such as `Shield` from `lucide-react`, in a small tile. It is decorative: the title names the row. */
  icon?: ListRowIcon;
  title: string;
  /**
   * Draws the macro's colour as an 8 px square before the title, as the Targets page's four figures do, and sets the
   * title in the body weight, not the strong one. It is decoration, so the row's accessible name is unchanged.
   */
  macro?: ListRowMacro | undefined;
  subtitle?: string | undefined;
  /**
   * A short status drawn between the text and the value, such as the weigh-in list's "Left out of trend" in
   * the warning tone. Beside the value from the medium width, and under the subtitle below it, where the
   * row is too narrow for both. One short phrase from `@keylow/core/copy`.
   */
  badge?: { label: string; tone: BadgeTone } | undefined;
  /** A short value that sits after the title, before the chevron, such as the calorie target on the Targets row. */
  value?: string | undefined;
  /** The unit after the value, in the muted caption look, such as `kg`. */
  unit?: string | undefined;
  /**
   * How the value is drawn. `quiet`, the default, is secondary body text, for a count beside a title. `numeral`
   * is a strong figure in the primary colour, for an amount such as a weigh-in.
   */
  valueLook?: "quiet" | "numeral" | undefined;
  /** `muted` draws the value in the muted text colour, as the weigh-in the trend left out. */
  valueTone?: "muted" | undefined;
  /**
   * `danger` draws the title in the danger colour, for an action that deletes, such as Delete all conversations.
   * `secondary` draws it muted, for a row that is done, such as a change the assistant made that was undone.
   * `primary` is the default.
   */
  titleTone?: "danger" | "secondary" | "primary" | undefined;
  /**
   * `regular` sets the title in the body weight, as the assistant's starter rows draw it, and `strong`, the
   * default, in the strong weight. A row with a macro key is always regular.
   */
  titleWeight?: "regular" | "strong" | undefined;
  /**
   * An icon at the end of a row that does something, such as the assistant starters' up arrow, drawn 16 px in the
   * muted ink and in place of the chevron. It is decorative: the title names the row.
   */
  trailingIcon?: ListRowIcon | undefined;
  /** The chevron marks a row that goes somewhere. Leave it off for an action such as signing out. */
  chevron?: boolean;
  disabled?: boolean;
  className?: string;
};

/** A tick for something that is done. */
export type ListRowTick = { kind: "tick"; label: string };

/**
 * What a row that goes nowhere can draw at its end, besides a tick. `action` is a text button in the accent ink with
 * the label as its words, named with the row's title ("Undo, Logged 2 eggs"), and its own tab stop. `busy` marks it
 * working: it stays enabled so focus is kept, and a press does nothing until it clears. `label` is plain muted
 * text, such as "Undone" or "Can't undo". One short phrase from `@keylow/core/copy`.
 */
export type ListRowEndAction = {
  kind: "action";
  label: string;
  onPress: () => void;
  busy?: boolean;
};
export type ListRowEndLabel = { kind: "label"; label: string };

/** The switch at the end of a row that turns something on or off. */
export type ListRowToggle = {
  isOn: boolean;
  /** The switch's accessible name. The row's title is hidden from assistive technology, so this says all of it. */
  label: string;
  /** Called with the state the press asks for. The owner decides whether the row follows, so a refused write leaves it as it was. */
  onValueChange: (next: boolean) => void;
  /** Dims the switch and ignores a press, such as until the setting is read or while a change is being saved. Focus is kept. */
  disabled?: boolean | undefined;
};

type NoOtherKind = {
  href?: never;
  onClick?: never;
  submit?: never;
  loading?: never;
  toggle?: never;
};

/** What a row that does something else can draw at its end: a tick, which is drawn before any chevron. */
type ListRowTickEnd = {
  /**
   * A tick at the end of the row for something that is done, such as the export's file row once it is ready. It is
   * a picture with the label as its name, so the row's state is read out, and it is drawn after the value, before any chevron, and a row that is loading draws its spinner instead.
   */
  trailing?: ListRowTick | undefined;
};

/**
 * A row goes to a page, runs an action, submits the form around it, carries a switch, or is plain text. It cannot
 * do two of these.
 */
export type ListRowProps = ListRowContent &
  (
    | (Omit<NoOtherKind, "href"> & { href: string } & ListRowTickEnd)
    | ({
        /** The click's event is passed on, so an owner can keep the button that was pressed, such as to return focus to it. */
        onClick: (event: MouseEvent<HTMLButtonElement>) => void;
        href?: never;
        submit?: never;
        toggle?: never;
        /**
         * Shows a spinner in place of the chevron and marks the row busy, for a row whose press is being
         * worked on. The row stays enabled, so focus is kept, but a press does nothing until it clears.
         */
        loading?: boolean;
      } & ListRowTickEnd)
    | (Omit<NoOtherKind, "submit"> & { submit: true } & ListRowTickEnd)
    | ({
        /** The switch is the row's one control, so the row goes nowhere and has no chevron. */
        toggle: ListRowToggle;
        href?: never;
        onClick?: never;
        submit?: never;
        loading?: never;
      } & ListRowTickEnd)
    | (NoOtherKind & ListRowTickEnd)
    | (NoOtherKind & {
        /**
         * A row with an action or a label at its end is drawn in a row of its own, 60 high, with the title, the
         * subtitle and the end only, so what it would drop is refused here.
         */
        trailing: ListRowEndAction | ListRowEndLabel;
        icon?: never;
        macro?: never;
        badge?: never;
        value?: never;
        unit?: never;
        valueLook?: never;
        valueTone?: never;
        chevron?: never;
        trailingIcon?: never;
        titleWeight?: never;
        disabled?: never;
        titleTone?: "secondary" | "primary" | undefined;
      })
  );
