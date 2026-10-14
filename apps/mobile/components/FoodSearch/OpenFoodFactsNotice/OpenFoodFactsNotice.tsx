import { OPEN_FOOD_FACTS_SEARCH_FAILED } from "@keylow/core/copy";

import { Banner } from "../../ui";
import { openFoodFactsBusyTitle } from "../openFoodFactsBusyTitle";

import type { OpenFoodFactsNoticeProps } from "./types";

/**
 * Why Open Food Facts gave nothing. It is a quiet notice and never red, because the user's own results
 * still work, and it has no retry, since the search runs again when the query changes.
 */
export function OpenFoodFactsNotice({ error }: OpenFoodFactsNoticeProps) {
  if (error.kind === "rate_limited") {
    return <Banner icon="Clock" title={openFoodFactsBusyTitle(error.retryAfterSeconds)} />;
  }

  return (
    <Banner
      body={OPEN_FOOD_FACTS_SEARCH_FAILED.body}
      icon="CloudOff"
      title={OPEN_FOOD_FACTS_SEARCH_FAILED.title}
    />
  );
}
