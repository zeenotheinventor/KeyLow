import { iconStroke } from "@keylow/tokens";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { GoalAnswerRowProps } from "./types";

/**
 * A row of the Goal page as `goals · edit` draws it: the question as a caption in a 92 px column, the answer as
 * body text that fills the row and wraps, and a chevron. It is 56 px tall at least and is one link, named for
 * the whole row. The kit's `ListRow` puts its value in a slot that does not wrap and has no caption column, so
 * a long Equipment answer would not fit it. The hairline between rows comes from the list around them.
 */
export function GoalAnswerRow({ label, value, name, href }: GoalAnswerRowProps) {
  return (
    <li>
      <Link
        href={href}
        aria-label={name}
        className="flex min-h-[56px] w-full items-center gap-3 px-3 py-2 text-text-primary outline-none transition-[transform,background-color] duration-instant ease-spring hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring active:scale-[0.985] active:bg-press-overlay motion-reduce:active:scale-100"
      >
        <span className="w-[92px] shrink-0 text-caption text-text-secondary">{label}</span>
        <span className="min-w-0 flex-1 text-body">{value}</span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-text-muted"
          strokeWidth={iconStroke}
        />
      </Link>
    </li>
  );
}
