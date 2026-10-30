import { FOOD_DETAIL } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import type { BackToFoodsLinkProps } from "./types";

import { cn } from "@/lib/utils";

const FOODS_HREF = "/foods";

// Each class is written out whole so Tailwind can see it. The quiet link is 36 px high, so an invisible
// pseudo element reaches 4 px above and below to a 44 px target. The accent link is already 44 px.
const toneClasses = {
  quiet:
    "relative min-h-control-sm text-text-secondary after:absolute after:inset-x-0 after:-inset-y-1",
  accent: "min-h-touch-target text-accent-ink",
} as const satisfies Record<NonNullable<BackToFoodsLinkProps["tone"]>, string>;

const chevronClasses = {
  quiet: "size-4",
  accent: "size-[18px]",
} as const satisfies Record<NonNullable<BackToFoodsLinkProps["tone"]>, string>;

/** The way back from a food to the foods page, above everything else on the screen. */
export function BackToFoodsLink({
  label = FOOD_DETAIL.back,
  href = FOODS_HREF,
  onClick,
  tone = "quiet",
  ref,
}: BackToFoodsLinkProps) {
  return (
    <Link
      ref={ref}
      href={href}
      {...(onClick === undefined ? {} : { onClick })}
      className={cn(
        "-ml-1 inline-flex items-center gap-1 self-start rounded-small pl-1 pr-2 text-[14px] font-semibold leading-5 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
        toneClasses[tone],
      )}
    >
      <ChevronLeft aria-hidden className={chevronClasses[tone]} strokeWidth={iconStroke} />
      {label}
    </Link>
  );
}
