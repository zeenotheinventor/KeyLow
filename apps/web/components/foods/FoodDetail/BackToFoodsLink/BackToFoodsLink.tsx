import { FOOD_DETAIL } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import type { BackToFoodsLinkProps } from "./types";

/** The way back from a food to the foods page, above everything else on the screen. */
export function BackToFoodsLink({ label = FOOD_DETAIL.back }: BackToFoodsLinkProps) {
  return (
    <Link
      href="/foods"
      className="-ml-1 inline-flex min-h-[36px] items-center gap-1 self-start rounded-small pl-1 pr-2 text-[14px] font-semibold leading-5 text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <ChevronLeft aria-hidden className="size-4" strokeWidth={iconStroke} />
      {label}
    </Link>
  );
}
