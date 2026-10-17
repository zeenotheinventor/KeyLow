import { useId } from "react";

import type { GroupedListProps } from "./types";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/** A titled section holding a card of rows. The rows are separated by a hairline. */
export function GroupedList({
  title,
  source,
  label,
  seeMore,
  headerSize = "default",
  notice,
  children,
  className,
}: GroupedListProps) {
  const titleId = useId();

  return (
    <section
      aria-label={label}
      aria-labelledby={label === undefined ? titleId : undefined}
      className={cn("flex flex-col gap-2", className)}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-1",
          headerSize === "default" && "min-h-[32px]",
        )}
      >
        <h2 className="text-body-strong">
          <span id={titleId}>{title}</span>
          {source !== undefined && (
            <span className="text-caption text-text-muted"> · {source}</span>
          )}
        </h2>
        {seeMore !== undefined && seeMore.hiddenCount > 0 && (
          // The button is taller than its text so it is a 44 px target. The negative margin keeps the
          // header's height as drawn.
          <button
            type="button"
            onClick={seeMore.onClick}
            className="-mx-1 -my-1.5 min-h-touch-target rounded-small px-1 text-[14px] font-semibold leading-5 text-text-secondary outline-none transition-colors duration-quick hover:bg-hover-overlay active:bg-press-overlay focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            See {seeMore.hiddenCount} more <span className="sr-only">in {title}</span>
          </button>
        )}
      </div>
      {notice}
      <Card asChild padding="none">
        <ul className="divide-y divide-border">{children}</ul>
      </Card>
    </section>
  );
}
