import type { BadgeTone } from "@/components/ui/Badge";
import type { ComponentType } from "react";

/** What the row needs of an icon: the props it sets. A `lucide-react` icon fits. */
export type ListRowIcon = ComponentType<{
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}>;

type ListRowContent = {
  /** A leading icon, such as `Shield` from `lucide-react`, in a small tile. It is decorative: the title names the row. */
  icon?: ListRowIcon;
  title: string;
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
   * A tick at the end of the row for something that is done, such as the export's file row once it is ready. It is
   * a picture with the label as its name, so the row's state is read out, and it is drawn after the value, before any chevron, and a row that is loading draws its spinner instead.
   */
  trailing?: { kind: "tick"; label: string } | undefined;
  /** The chevron marks a row that goes somewhere. Leave it off for an action such as signing out. */
  chevron?: boolean;
  disabled?: boolean;
  className?: string;
};

/** A row goes to a page, runs an action, submits the form around it, or is plain text. It cannot do two of these. */
export type ListRowProps = ListRowContent &
  (
    | { href: string; onClick?: never; submit?: never; loading?: never }
    | {
        onClick: () => void;
        href?: never;
        submit?: never;
        /**
         * Shows a spinner in place of the chevron and marks the row busy, for a row whose press is being
         * worked on. The row stays enabled, so focus is kept, but a press does nothing until it clears.
         */
        loading?: boolean;
      }
    | { submit: true; href?: never; onClick?: never; loading?: never }
    | { href?: never; onClick?: never; submit?: never; loading?: never }
  );
