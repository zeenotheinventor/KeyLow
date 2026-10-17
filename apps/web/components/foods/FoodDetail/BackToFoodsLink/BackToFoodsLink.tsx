import { FOOD_DETAIL } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import type { BackToFoodsLinkProps } from "./types";

import { cn } from "@/lib/utils";

const FOODS_HREF = "/foods";

// Each class is written out whole so Tailwind can see it.
const toneClasses = {
  quiet: "min-h-control-sm text-text-secondary",
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
}: BackToFoodsLinkProps) {
  return (
    <Link
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
