import { iconStroke } from "@keylow/tokens";
import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";

import type { ListRowMacro, ListRowProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

// The row sits inside a card that clips its corners, so the keyboard focus ring is drawn inside
// the row. Hover and press tint the row itself, which is transparent on the card's surface.
const rowClasses =
  "flex min-h-[56px] w-full items-center gap-3 px-3 py-2 text-left text-text-primary outline-none transition-[transform,background-color] duration-instant ease-spring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring";

const interactiveClasses =
  "cursor-pointer hover:bg-hover-overlay active:scale-[0.985] active:bg-press-overlay motion-reduce:active:scale-100";

// Each class is written out whole so Tailwind can see it.
const valueClasses = {
  quiet: { default: "text-body text-text-secondary", muted: "text-body text-text-muted" },
  numeral: {
    default: "text-body-strong text-text-primary",
    muted: "text-body-strong text-text-muted",
  },
} as const;

// Each class is written out whole so Tailwind can see it.
const macroKeyClasses = {
  calories: "bg-calories",
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
} as const satisfies Record<ListRowMacro, string>;

// The switch is drawn as the Assistant board draws it: a 51 by 31 track with a 27 px knob. The colours follow the
// button's own aria-checked, so it cannot draw one state while announcing the other. The button is 44 high, the
// touch target, and the track sits in its middle. The knob is the light text colour on dark and white on light, as the
// board draws it. Every class is written out whole so Tailwind can see it.
const switchButtonClasses =
  "group flex h-11 shrink-0 items-center rounded-pill outline-none focus-visible:ring-2 focus-visible:ring-focus-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const switchTrackClasses =
  "relative h-[31px] w-[51px] rounded-pill bg-border-strong transition-colors duration-quick motion-reduce:transition-none group-aria-checked:bg-accent";

const switchKnobClasses =
  "absolute left-[2px] top-[2px] size-[27px] rounded-pill bg-text-primary shadow-card transition-transform duration-standard ease-spring motion-reduce:transition-none group-aria-checked:translate-x-5 group-aria-checked:bg-accent-foreground [[data-theme=light]_&]:bg-surface-raised [[data-theme=light]_&]:group-aria-checked:bg-accent-foreground";

/** A row of a settings or menu list: a title, an optional subtitle and a chevron when it navigates. Put it inside a `GroupedList`. */
export function ListRow({
  icon: Icon,
  title,
  macro,
  titleTone,
  titleWeight,
  trailingIcon: TrailingIcon,
  subtitle,
  badge,
  value,
  unit,
  valueLook = "quiet",
  valueTone,
  trailing,
  href,
  onClick,
  submit,
  chevron = true,
  disabled = false,
  loading = false,
  toggle,
  className,
}: ListRowProps) {
  const interactive = href !== undefined || onClick !== undefined || submit === true;
  const classes = cn(
    rowClasses,
    interactive && interactiveClasses,
    disabled && "pointer-events-none opacity-50",
    className,
  );
  const textLines = (
    <>
      <span
        className={cn(
          macro === undefined && titleWeight !== "regular" ? "text-body-strong" : "text-body",
          titleTone === "danger" && "text-danger",
          titleTone === "secondary" && "text-text-secondary",
          "[overflow-wrap:anywhere]",
        )}
      >
        {title}
      </span>
      {subtitle !== undefined && <span className="text-caption text-text-muted">{subtitle}</span>}
    </>
  );
  const text = <span className="flex min-w-0 flex-1 flex-col gap-0.5">{textLines}</span>;
  const content = (
    <>
      {Icon !== undefined && (
        <span className="flex h-control-sm w-control-sm shrink-0 items-center justify-center rounded-small bg-surface-raised text-text-secondary">
          <Icon aria-hidden className="size-5" strokeWidth={iconStroke} />
        </span>
      )}
      {macro !== undefined && (
        <span aria-hidden className={cn("size-2 shrink-0 rounded-[2px]", macroKeyClasses[macro])} />
      )}
      {badge === undefined ? (
        text
      ) : (
        // From the medium width the badge sits at the end of the text, beside the value. Below it the
        // badge is under the subtitle, where the row has no room beside the value.
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-center md:justify-between md:gap-3">
          <span className="flex min-w-0 flex-col gap-0.5">{textLines}</span>
          <Badge tone={badge.tone} className="mt-0.5 self-start md:mt-0 md:self-auto">
            {badge.label}
          </Badge>
        </span>
      )}
      {value !== undefined && (
        <span className="flex shrink-0 items-baseline gap-1">
          <span className={cn("tabular-nums", valueClasses[valueLook][valueTone ?? "default"])}>
            {value}
          </span>
          {unit !== undefined && <span className="text-caption text-text-muted">{unit}</span>}
        </span>
      )}
      {loading ? (
        // The ring is the size of the button spinner's, in a box of its own so the row keeps its height.
        <span className="relative size-[18px] shrink-0">
          <span
            role="img"
            aria-label="Loading"
            className="absolute inset-0 animate-spin rounded-pill border-2 border-text-muted border-r-transparent motion-reduce:animate-pulse"
          />
        </span>
      ) : null}
      {!loading && trailing?.kind === "tick" && (
        <span role="img" aria-label={trailing.label} className="flex shrink-0">
          <Check aria-hidden className="size-5 stroke-success" strokeWidth={iconStroke} />
        </span>
      )}
      {!loading && interactive && TrailingIcon !== undefined && (
        <TrailingIcon
          aria-hidden
          className="size-4 shrink-0 text-text-muted"
          strokeWidth={iconStroke}
        />
      )}
      {!loading && interactive && TrailingIcon === undefined && chevron && (
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-text-muted"
          strokeWidth={iconStroke}
        />
      )}
    </>
  );

  if (trailing?.kind === "action" || trailing?.kind === "label") {
    // The row goes nowhere. The words are one group, the button is a stop of its own and a label is plain text, as
    // `web-assistant-settings · changes` draws its rows: 60 high, with 8 beside the end and 16 before the words.
    return (
      <li>
        <div
          className={cn(
            "flex min-h-[60px] w-full items-center gap-3 py-2 pl-4 pr-2 text-left text-text-primary",
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              className={cn(
                "text-body-strong [overflow-wrap:anywhere]",
                titleTone === "secondary" && "text-text-secondary",
              )}
            >
              {title}
            </span>
            {subtitle !== undefined && (
              <span className="text-caption tabular-nums text-text-muted">{subtitle}</span>
            )}
          </span>
          {trailing.kind === "label" ? (
            <span className="shrink-0 px-3 text-caption text-text-muted">{trailing.label}</span>
          ) : (
            <button
              type="button"
              aria-label={`${trailing.label}, ${title}`}
              aria-busy={trailing.busy === true || undefined}
              // The button is 36 high and reaches the 44 touch target with the row's padding around it.
              className="relative flex h-control-sm shrink-0 cursor-pointer items-center rounded-small px-3 text-label-small text-accent-ink outline-none before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-press-overlay"
              onClick={() => {
                if (trailing.busy !== true) {
                  trailing.onPress();
                }
              }}
            >
              {trailing.label}
            </button>
          )}
        </div>
      </li>
    );
  }

  if (toggle !== undefined) {
    // The switch is the row's one control, so the row is plain and the switch keeps its own name. The visible
    // words are hidden from a screen reader, which would otherwise read them and then the switch's name.
    return (
      <li>
        <div className={classes}>
          <div aria-hidden className="flex min-w-0 flex-1 items-center gap-3">
            {content}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={toggle.isOn}
            aria-label={toggle.label}
            // The switch stays enabled so focus is kept while it is busy, and ignores a press until it clears.
            aria-disabled={toggle.disabled === true || undefined}
            className={switchButtonClasses}
            onClick={() => {
              if (toggle.disabled !== true) {
                toggle.onValueChange(!toggle.isOn);
              }
            }}
          >
            <span aria-hidden className={switchTrackClasses}>
              <span className={switchKnobClasses} />
            </span>
          </button>
        </div>
      </li>
    );
  }

  if (href !== undefined) {
    return (
      <li>
        {disabled ? (
          // A link that is off has no destination. The role keeps it announced as a link, and
          // aria-disabled says it is not available.
          // eslint-disable-next-line jsx-a11y/anchor-is-valid
          <a className={classes} role="link" aria-disabled>
            {content}
          </a>
        ) : (
          <Link href={href} className={classes}>
            {content}
          </Link>
        )}
      </li>
    );
  }

  if (onClick !== undefined || submit === true) {
    return (
      <li>
        <button
          type={submit === true ? "submit" : "button"}
          className={classes}
          // A busy row stays enabled so focus is kept, and ignores a press until it clears.
          onClick={loading ? undefined : onClick}
          disabled={disabled}
          aria-busy={loading || undefined}
        >
          {content}
        </button>
      </li>
    );
  }

  return (
    <li>
      <div className={classes}>{content}</div>
    </li>
  );
}
