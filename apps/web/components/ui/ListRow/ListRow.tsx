import { iconStroke } from "@keylow/tokens";
import { ChevronRight } from "lucide-react";

import type { ListRowProps } from "./types";

import { cn } from "@/lib/utils";

// The row sits inside a card that clips its corners, so the keyboard focus ring is drawn inside
// the row. Hover and press tint the row itself, which is transparent on the card's surface.
const rowClasses =
  "flex min-h-[56px] w-full items-center gap-3 px-3 py-2 text-left text-text-primary outline-none transition-[transform,background-color] duration-instant ease-spring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring";

const interactiveClasses =
  "cursor-pointer hover:bg-hover-overlay active:scale-[0.985] active:bg-press-overlay motion-reduce:active:scale-100";

/** A row of a settings or menu list: a title, an optional subtitle and a chevron when it navigates. Put it inside a `GroupedList`. */
export function ListRow({
  title,
  subtitle,
  href,
  onClick,
  chevron = true,
  disabled = false,
  className,
}: ListRowProps) {
  const interactive = href !== undefined || onClick !== undefined;
  const classes = cn(
    rowClasses,
    interactive && interactiveClasses,
    disabled && "pointer-events-none opacity-50",
    className,
  );
  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-strong">{title}</span>
        {subtitle !== undefined && <span className="text-caption text-text-muted">{subtitle}</span>}
      </span>
      {interactive && chevron && (
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-text-muted"
          strokeWidth={iconStroke}
        />
      )}
    </>
  );

  if (href !== undefined) {
    // A link that is off has no destination. The role keeps it announced as a link, and
    // aria-disabled says it is not available.
    return (
      <li>
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a
          className={classes}
          href={disabled ? undefined : href}
          role={disabled ? "link" : undefined}
          aria-disabled={disabled || undefined}
        >
          {content}
        </a>
      </li>
    );
  }

  if (onClick !== undefined) {
    return (
      <li>
        <button type="button" className={classes} onClick={onClick} disabled={disabled}>
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
