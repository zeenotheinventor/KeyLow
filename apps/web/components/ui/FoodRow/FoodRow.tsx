import { iconStroke } from "@keylow/tokens";
import { ChevronRight, LoaderCircle, Utensils } from "lucide-react";
import Link from "next/link";

import { FoodLogRow } from "./FoodLogRow";
import { FoodTableRow } from "./FoodTableRow";
import { interactiveClasses } from "./rowStates";

import type { FoodListRowProps, FoodRowMacros, FoodRowProps } from "./types";

import { cn } from "@/lib/utils";

// The boards draw this row on the search and Your foods lists. It is a design system addition
// that extends ListRow, so these values are the boards'. Like ListRow, the focus ring is drawn
// inside the row because the list clips its corners.
const rowClasses =
  "flex min-h-[60px] w-full items-center gap-3 px-3 py-2 text-left text-text-primary no-underline outline-none transition-[transform,background-color] duration-instant ease-spring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring";

const macroDots = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
} as const;

const macroLetters = { protein: "P", carbs: "C", fat: "F" } as const;

const macroOrder = ["protein", "carbs", "fat"] as const;

// The values sit beside a colour mark, never coloured themselves. A screen reader gets the sentence
// instead of the bare letters.
function Macros({ macros, basis }: { macros: FoodRowMacros; basis?: string | undefined }) {
  return (
    <>
      <span aria-hidden className="flex items-center gap-[10px] text-caption text-text-secondary">
        {macroOrder.map((macro) => (
          <span key={macro} className="inline-flex items-center gap-1">
            <span className={cn("size-[6px] rounded-[2px]", macroDots[macro])} />
            <span>{macros[macro]}</span> {macroLetters[macro]}
          </span>
        ))}
        {basis !== undefined && <span className="text-text-muted">{basis}</span>}
      </span>
      <span className="sr-only">{macros.description}</span>
    </>
  );
}

/**
 * A food on the search and Your foods lists: its name with the matched words in bold, then its macros and
 * energy. Put it inside a `GroupedList`. Give it a `layout` for the food log's rows instead.
 */
export function FoodRow(props: FoodRowProps) {
  if (props.layout === "table") {
    return <FoodTableRow {...props} />;
  }
  if (props.layout !== undefined) {
    return <FoodLogRow {...props} />;
  }
  return <FoodListRow {...props} />;
}

function FoodListRow({
  nameSegments,
  brand,
  energy,
  macros,
  basis,
  note,
  busyLabel,
  disabled = false,
  href,
  onClick,
  className,
}: FoodListRowProps) {
  const busy = busyLabel !== undefined;
  const unavailable = disabled || busy;
  const classes = cn(
    rowClasses,
    !unavailable && interactiveClasses,
    unavailable && "pointer-events-none",
    // A busy row stays at full strength. The rows around it are the ones that are dimmed.
    disabled && !busy && "opacity-50",
    className,
  );
  const detail = busy ? (
    <span className="text-caption text-text-secondary">{busyLabel}</span>
  ) : macros !== undefined ? (
    <Macros macros={macros} basis={basis} />
  ) : note !== undefined ? (
    <span className="text-caption text-text-muted">{note}</span>
  ) : null;

  const content = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-small bg-surface-raised text-text-secondary">
        <Utensils aria-hidden className="size-5" strokeWidth={iconStroke} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-body leading-[22px]">
          {nameSegments.map((segment, index) => (
            <span
              // The segments are cut from one name, so their order never changes.
              key={index}
              className={segment.matched ? "font-semibold" : "font-normal"}
            >
              {segment.text}
            </span>
          ))}
          {brand !== undefined && (
            <>
              {" "}
              <span className="text-text-muted">· {brand}</span>
            </>
          )}
        </span>
        {detail}
      </span>
      {busy ? (
        <LoaderCircle
          aria-hidden
          className="size-5 shrink-0 animate-spin text-accent motion-reduce:animate-pulse light-theme:text-text-primary"
          strokeWidth={iconStroke}
        />
      ) : (
        <>
          {energy !== undefined && (
            <span className="flex shrink-0 items-baseline gap-[3px]">
              <span className="text-numeral-small">{energy}</span>
              <span className="text-caption text-text-muted">kcal</span>
            </span>
          )}
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-text-muted"
            strokeWidth={iconStroke}
          />
        </>
      )}
    </>
  );

  if (href !== undefined) {
    return (
      <li>
        {unavailable ? (
          // A link that is off has no destination, which is how a disabled link is written.
          // eslint-disable-next-line jsx-a11y/anchor-is-valid
          <a className={classes} role="link" aria-disabled aria-busy={busy || undefined}>
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

  return (
    <li>
      <button
        type="button"
        className={classes}
        onClick={unavailable ? undefined : onClick}
        aria-disabled={unavailable || undefined}
        aria-busy={busy || undefined}
      >
        {content}
      </button>
    </li>
  );
}
