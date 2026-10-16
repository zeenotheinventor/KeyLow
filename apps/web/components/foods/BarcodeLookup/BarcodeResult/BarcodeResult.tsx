import {
  BARCODE_LOOKUP_FAILED,
  BARCODE_LOOKUP_PROGRESS,
  BARCODE_NOT_FOUND,
  OPEN_FOOD_FACTS_BUSY,
  describeBarcodeRateLimit,
} from "@keylow/core/copy";
import Link from "next/link";

import type { BarcodeResultProps } from "./types";

import { InlineStatus } from "@/components/foods/InlineStatus";
import { Banner } from "@/components/ui/Banner";

/** What to show under the barcode field once a code has been looked up. Finding the food is shown here as "Opening the food" and the panel does the opening. */
export function BarcodeResult({ result, isLoading, error, day }: BarcodeResultProps) {
  if (result?.status === "found") {
    return <InlineStatus size="small">{BARCODE_LOOKUP_PROGRESS.openingFood}</InlineStatus>;
  }

  if (error !== null) {
    return error.kind === "rate_limited" ? (
      <Banner tone="error" title={OPEN_FOOD_FACTS_BUSY}>
        {describeBarcodeRateLimit(error.retryAfterSeconds)}
      </Banner>
    ) : (
      <Banner tone="error" title={BARCODE_LOOKUP_FAILED.title}>
        {BARCODE_LOOKUP_FAILED.body}
      </Banner>
    );
  }

  if (isLoading) {
    return <InlineStatus size="small">{BARCODE_LOOKUP_PROGRESS.lookingUp}</InlineStatus>;
  }

  if (result?.status === "not_found") {
    return (
      <div className="flex flex-col gap-2 border-t border-border pt-1">
        <span className="pt-2 text-body-strong">{BARCODE_NOT_FOUND.title}</span>
        <span className="text-[14px] leading-5 text-text-secondary">
          {BARCODE_NOT_FOUND.typedBody}
        </span>
        <Link
          href={`/foods/new?barcode=${result.code}${day === undefined ? "" : `&day=${day}`}`}
          className="inline-flex min-h-touch-target items-center gap-1.5 self-start rounded-small text-body-strong text-text-primary underline outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {BARCODE_NOT_FOUND.action}
        </Link>
      </div>
    );
  }

  return null;
}
