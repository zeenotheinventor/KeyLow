import { iconStroke } from "@keylow/tokens";
import { Check, Info } from "lucide-react";
import * as React from "react";

import { Badge } from "../Badge";

import type { OptionCardProps } from "./types";

import { cn } from "@/lib/utils";

// A chosen card is the accent border on the muted accent fill, as the goals board draws it. The marks are
// the checkbox card's: a square with rounded corners at the end of the card, as the focus board draws it.
const cardClasses =
  "relative flex min-h-16 w-full items-center gap-3 rounded-medium border-[1.5px] border-border bg-surface p-3 text-left text-text-primary outline-none transition-colors duration-quick hover:before:bg-hover-overlay before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:transition-colors before:duration-quick motion-reduce:transition-none aria-checked:border-accent aria-checked:bg-accent-muted focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset disabled:cursor-not-allowed disabled:hover:before:bg-transparent";

const markClasses =
  "flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-border-strong text-accent-foreground transition-colors duration-quick motion-reduce:transition-none group-aria-checked:border-accent group-aria-checked:bg-accent [&>svg]:invisible group-aria-checked:[&>svg]:visible";

// Spoken, a name stops at a comma, so a closing full stop on a sentence adds nothing.
function withoutFinalStop(words: string): string {
  return words.endsWith(".") ? words.slice(0, -1) : words;
}

/**
 * The name a screen reader gives the card: the title, then the badge, the description, the reason it is
 * disabled and the value, each as it was given. The card reads as one radio or checkbox, so its parts are
 * one name.
 */
function accessibleName({
  title,
  badge,
  description,
  disabledReason,
  value,
  valueCaption,
  valueLabel,
}: OptionCardProps): string {
  const spokenValue = valueLabel ?? [value, valueCaption].filter(Boolean).join(" ");
  const spokenBadge = typeof badge?.children === "string" ? badge.children : undefined;

  return [title, spokenBadge, description, disabledReason, spokenValue]
    .filter((words): words is string => words !== undefined && words !== "")
    .map(withoutFinalStop)
    .join(", ");
}

/**
 * A card that is one answer to a question, at least 64 px high, with a title and optionally a description, a
 * badge, a figure at the end with a caption, and a reason it cannot be chosen. It is a radio for a screen
 * reader (a checkbox with `selection="multiple"`), named by its parts, and belongs in an `OptionCardGroup`,
 * which handles the arrow keys.
 *
 * With `selection="multiple"` it is one of several answers: it draws a square mark at its end that holds a
 * check when it is checked, and pressing a checked card calls `onPress` again so the answer can be cleared.
 */
export const OptionCard = React.forwardRef<
  HTMLButtonElement,
  OptionCardProps & Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, "onKeyDown" | "tabIndex">
>(function OptionCard(props, ref) {
  const {
    title,
    description,
    badge,
    value,
    valueCaption,
    selection = "single",
    checked,
    disabledReason,
    onPress,
    onKeyDown,
    tabIndex,
  } = props;
  const isDisabled = disabledReason !== undefined;
  const isCheckbox = selection === "multiple";
  const dimClassName = isDisabled ? "opacity-40" : undefined;

  return (
    <button
      ref={ref}
      type="button"
      role={isCheckbox ? "checkbox" : "radio"}
      aria-checked={checked}
      aria-label={accessibleName(props)}
      disabled={isDisabled}
      tabIndex={tabIndex}
      // Pressing the chosen radio changes nothing, so it says nothing. A checkbox clears when pressed again.
      onClick={checked && !isCheckbox ? undefined : onPress}
      onKeyDown={onKeyDown}
      className={cn("group", cardClasses)}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("flex items-center gap-2", dimClassName)}>
          <span className="text-body-strong">{title}</span>
          {badge === undefined ? null : <Badge {...badge} />}
        </span>
        {description === undefined ? null : (
          <span className={cn("text-caption text-text-secondary", dimClassName)}>
            {description}
          </span>
        )}
        {disabledReason === undefined ? null : (
          <span className="flex items-center gap-1.5 text-caption text-text-secondary">
            <Info aria-hidden className="size-3.5 shrink-0" />
            {disabledReason}
          </span>
        )}
      </span>
      {value === undefined ? null : (
        <span className={cn("flex shrink-0 flex-col items-end", dimClassName)}>
          <span className="text-body-strong">{value}</span>
          {valueCaption === undefined ? null : (
            <span className="text-caption text-text-muted">{valueCaption}</span>
          )}
        </span>
      )}
      {isCheckbox ? (
        <span aria-hidden className={cn(markClasses, dimClassName)}>
          <Check aria-hidden className="size-[14px]" strokeWidth={iconStroke} />
        </span>
      ) : null}
    </button>
  );
});
