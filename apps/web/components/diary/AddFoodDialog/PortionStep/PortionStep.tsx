import {
  ADD_FOOD_DIALOG,
  FOOD_DETAIL,
  FOOD_NOT_FOUND,
  FOOD_NOT_LOADED,
  FOOD_REVIEW_ACTION_IN_NEW_TAB,
  FOOD_REVIEW_BANNER,
  SAVE_FAILED_BANNER,
  describeMissingValuesBeforeLogging,
} from "@keylow/core/copy";
import { missingFieldsOf } from "@keylow/core/diary";
import { iconStroke } from "@keylow/tokens";
import { ChevronLeft, SearchX } from "lucide-react";

import type { PortionStepProps } from "./types";

import { PortionFields } from "@/components/diary/PortionFields";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The add dialog's second step, for the food a row opened: a Results link, then what the chosen amount
 * comes to, the amount, its unit and the Time field (an ingredient has none). A food that has to be
 * reviewed first says so, with a way to copy it to the person's own foods, and cannot be added from here.
 */
export function PortionStep({
  draft,
  hasSaveError = false,
  opensReviewInNewTab = false,
  onBack,
  amountRef,
  ...timeProps
}: PortionStepProps) {
  const back = (
    <Button
      type="button"
      variant="ghost"
      className="-ml-3 gap-0.5 self-start px-3 text-label-small"
      onClick={onBack}
    >
      <ChevronLeft aria-hidden strokeWidth={iconStroke} />
      {ADD_FOOD_DIALOG.backToResults}
    </Button>
  );

  if (draft.status !== "ready") {
    return (
      <>
        {back}
        {draft.status === "error" && (
          <ErrorState size="section" title={FOOD_NOT_LOADED.title} body={FOOD_NOT_LOADED.body} />
        )}
        {draft.status === "notFound" && (
          <EmptyState
            icon={SearchX}
            size="section"
            title={FOOD_NOT_FOUND.title}
            body={FOOD_NOT_FOUND.body}
          />
        )}
        {(draft.status === "loading" || draft.status === "idle") && (
          <Skeleton variant="block" label={FOOD_DETAIL.loading} />
        )}
      </>
    );
  }

  const { food } = draft;

  return (
    <>
      {back}
      <PortionFields
        name={food.name}
        food={food}
        portions={draft.portions}
        unitOptions={draft.unitOptions}
        preview={draft.preview}
        quantityText={draft.quantityText}
        unitValue={draft.unitValue}
        onQuantityChange={draft.setQuantityText}
        onUnitChange={draft.setUnitValue}
        amountRef={amountRef}
        {...timeProps}
        notice={
          <>
            {draft.needsReview && (
              <Banner
                tone="review"
                title={FOOD_REVIEW_BANNER.title}
                action={
                  opensReviewInNewTab
                    ? {
                        label: FOOD_REVIEW_ACTION_IN_NEW_TAB,
                        href: `/foods/new?from=${food.id}`,
                        newTab: true,
                      }
                    : { label: FOOD_REVIEW_BANNER.action, href: `/foods/new?from=${food.id}` }
                }
              >
                {describeMissingValuesBeforeLogging(
                  missingFieldsOf(food),
                  food.quality.carbs_convention,
                )}
              </Banner>
            )}
            {hasSaveError && <Banner tone="error">{SAVE_FAILED_BANNER}</Banner>}
          </>
        }
      />
    </>
  );
}
