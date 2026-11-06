import { iconStroke } from "@keylow/tokens";
import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";

import type { ListRowProps } from "./types";

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

/** A row of a settings or menu list: a title, an optional subtitle and a chevron when it navigates. Put it inside a `GroupedList`. */
export function ListRow({
  icon: Icon,
  title,
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
      <span className="text-body-strong [overflow-wrap:anywhere]">{title}</span>
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
      {!loading && trailing !== undefined && (
        <span role="img" aria-label={trailing.label} className="flex shrink-0">
          <Check aria-hidden className="size-5 stroke-success" strokeWidth={iconStroke} />
        </span>
      )}
      {!loading && interactive && chevron && (
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-text-muted"
          strokeWidth={iconStroke}
        />
      )}
    </>
  );

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
