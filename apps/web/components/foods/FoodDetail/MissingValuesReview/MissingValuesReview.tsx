import { FOOD_REVIEW_BANNER, describeMissingValues } from "@keylow/core/copy";

import type { MissingValuesReviewProps } from "./types";

import { Banner } from "@/components/ui/Banner";

/** Warns that a shared food is missing values, and offers the one way out: a copy the user completes. */
export function MissingValuesReview({
  foodId,
  fieldsMissing,
  carbsConvention,
}: MissingValuesReviewProps) {
  return (
    <Banner
      tone="review"
      title={FOOD_REVIEW_BANNER.title}
      action={{ label: FOOD_REVIEW_BANNER.action, href: `/foods/new?from=${foodId}` }}
    >
      {describeMissingValues(fieldsMissing, carbsConvention)}
    </Banner>
  );
}
