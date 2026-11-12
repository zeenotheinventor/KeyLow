import {
  OPEN_FOOD_FACTS_SEARCH_FAILED,
  SEARCH_RATE_LIMITED,
  describeRateLimit,
} from "@keylow/core/copy";
import { CloudOff } from "lucide-react";

import type { OpenFoodFactsNoticeProps } from "./types";

import { Banner } from "@/components/ui/Banner";

/** Says why the live Open Food Facts search found nothing to show, without taking the local results away. */
export function OpenFoodFactsNotice({ error }: OpenFoodFactsNoticeProps) {
  return error.kind === "rate_limited" ? (
    <Banner tone="info" icon={CloudOff} title={SEARCH_RATE_LIMITED}>
      {describeRateLimit(error.retryAfterSeconds)}
    </Banner>
  ) : (
    <Banner tone="info" icon={CloudOff} title={OPEN_FOOD_FACTS_SEARCH_FAILED.title}>
      {OPEN_FOOD_FACTS_SEARCH_FAILED.body}
    </Banner>
  );
}
