"use client";

import { keys, useRecipeRefreshPreview, useRefreshRecipeIngredients } from "@keylow/api-client";
import {
  DIARY_LOAD_FAILED,
  FOOD_FORM,
  RECIPE_ACTIONS,
  RECIPE_NOT_FOUND,
  RECIPE_TOASTS,
  REFRESH,
  RETRY_LABEL,
  SAVE_FAILED_BANNER,
} from "@keylow/core/copy";
import { isRecipeId } from "@keylow/core/recipes";
import { useQueryClient } from "@tanstack/react-query";
import { Check, SearchX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { RecipeRefreshContent } from "../RecipeRefreshContent";

import type { RecipeRefreshDialogProps } from "./types";
import type { RecipeRefreshDiff } from "@keylow/api-client";

import { DIARY_DIALOG_CLASSES } from "@/components/diary/diaryDialogClasses";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useIsOnline } from "@/lib/useIsOnline";

// A failure or a missing recipe sits in the middle of the room the dialog has, a little above the centre.
const STATE_CLASSES = "flex-1 justify-center border-0 bg-transparent px-6 py-0 pb-20";

const SKELETON_VALUE_WIDTHS = ["w-[84px]", "w-[64px]", "w-[48px]", "w-[64px]"];

function CheckingYourFoods() {
  return (
    <Skeleton label={REFRESH.loadingLabel} className="flex flex-col gap-4">
      <SkeletonBone className="h-[14px] w-[90%]" />
      <Card className="flex flex-col gap-4">
        <SkeletonBone className="h-[14px] w-24" />
        {SKELETON_VALUE_WIDTHS.map((valueWidth, position) => (
          // The lines are identical placeholders, so their position is their identity.
          <span key={position} className="flex justify-between">
            <SkeletonBone className="h-3 w-[72px]" />
            <SkeletonBone className={`h-3 ${valueWidth}`} />
          </span>
        ))}
      </Card>
      <Card className="flex flex-col gap-3">
        <SkeletonBone className="h-[14px] w-[60%]" />
        <SkeletonBone className="h-[10px] w-[30%]" />
        <SkeletonBone className="h-3 w-[45%]" />
      </Card>
      <Card className="flex flex-col gap-3">
        <SkeletonBone className="h-[14px] w-[50%]" />
        <SkeletonBone className="h-[10px] w-[25%]" />
      </Card>
    </Skeleton>
  );
}

function OpenRecipeRefreshDialog({ recipeId, onClose }: Omit<RecipeRefreshDialogProps, "open">) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const isKnownToBeMissing = !isRecipeId(recipeId);
  // Read afresh on every open: the preview keeps nothing once this dialog has gone, so a look at the foods
  // is never served to a later one.
  const preview = useRecipeRefreshPreview(isKnownToBeMissing ? undefined : recipeId);
  const refreshIngredients = useRefreshRecipeIngredients();
  const introRef = useRef<HTMLParagraphElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isApplyingNow = useRef(false);
  // Set once the save has worked: the dialog is on its way out, and nothing else is to be asked of it.
  const hasAppliedRef = useRef(false);
  const [isApplying, setIsApplying] = useState(false);
  const [hasApplyFailed, setHasApplyFailed] = useState(false);
  // The diff Apply was pressed on, kept on screen until the dialog goes, whatever the preview reads by then.
  const [appliedDiff, setAppliedDiff] = useState<RecipeRefreshDiff | null>(null);

  const shownDiff = appliedDiff ?? (preview.status === "ready" ? preview.diff : null);
  const hasChanges = shownDiff?.hasChanges === true;
  const isNothingToRefresh = shownDiff?.hasChanges === false;

  // Try again takes its own button away when it finds nothing to refresh, which would drop focus to the page
  // behind. Done is the only thing to press then, so focus goes there, unless it is still somewhere in the dialog.
  useEffect(() => {
    const body = bodyRef.current;
    const focusIsInDialog = body?.closest('[role="dialog"]')?.contains(document.activeElement);
    if (isNothingToRefresh && focusIsInDialog === false) {
      body?.querySelector("button")?.focus();
    }
  }, [isNothingToRefresh]);

  // The change is read before the buttons: focus starts on the intro once there is a diff.
  useEffect(() => {
    if (hasChanges) {
      introRef.current?.focus();
    }
  }, [hasChanges]);

  function leave() {
    if (!isApplyingNow.current && !hasAppliedRef.current) {
      onClose();
    }
  }

  async function apply() {
    if (isApplyingNow.current || hasAppliedRef.current || !isOnline || shownDiff === null) {
      return;
    }
    isApplyingNow.current = true;
    setIsApplying(true);
    setHasApplyFailed(false);
    setAppliedDiff(shownDiff);
    try {
      await refreshIngredients.mutateAsync(recipeId);
      hasAppliedRef.current = true;
      toast.show({ message: RECIPE_TOASTS.refreshed, tone: "success", icon: Check });
      onClose();
    } catch {
      // The failure can quote the recipe, so the person gets one fixed sentence and nothing is logged.
      setHasApplyFailed(true);
      setAppliedDiff(null);
    } finally {
      isApplyingNow.current = false;
      setIsApplying(false);
    }
  }

  function retry() {
    void queryClient.invalidateQueries({ queryKey: keys.recipes.refresh(recipeId) });
  }

  function renderBody() {
    if (shownDiff !== null) {
      return <RecipeRefreshContent diff={shownDiff} introRef={introRef} onDone={leave} />;
    }
    if (isKnownToBeMissing || preview.status === "notFound") {
      return (
        <EmptyState
          icon={SearchX}
          title={RECIPE_NOT_FOUND.title}
          body={RECIPE_NOT_FOUND.body}
          className={STATE_CLASSES}
        />
      );
    }
    if (preview.status === "error" || (preview.status === "loading" && !isOnline)) {
      return (
        <ErrorState
          title={REFRESH.loadFailed}
          body={DIARY_LOAD_FAILED.body}
          retryLabel={RETRY_LABEL}
          onRetry={retry}
          className={STATE_CLASSES}
        />
      );
    }
    return <CheckingYourFoods />;
  }

  return (
    <Dialog
      open
      className={DIARY_DIALOG_CLASSES}
      onClose={leave}
      title={RECIPE_ACTIONS.refresh}
      footer={
        hasChanges && (
          <>
            <Button
              type="button"
              variant="ghost"
              className="text-label-small text-text-secondary"
              disabled={isApplying}
              onClick={leave}
            >
              {FOOD_FORM.cancel}
            </Button>
            <Button
              type="button"
              aria-description={REFRESH.applyHint}
              aria-disabled={!isOnline || undefined}
              className={
                !isOnline ? "aria-disabled:pointer-events-none aria-disabled:opacity-40" : undefined
              }
              loading={isApplying}
              onClick={isOnline ? () => void apply() : undefined}
            >
              {REFRESH.apply}
            </Button>
          </>
        )
      }
    >
      <div ref={bodyRef} className="flex min-h-full flex-col gap-4">
        {hasApplyFailed && <Banner tone="error">{SAVE_FAILED_BANNER}</Banner>}
        {renderBody()}
      </div>
    </Dialog>
  );
}

/**
 * "Refresh ingredients" (brief 22): checks a recipe's foods afresh each time it opens, shows what Apply would
 * change and saves it on Apply, then closes with the toast "Ingredients refreshed". It sits over the recipe
 * view, which stays as it was, so the servings chosen there are untouched. Cancel, Close and Done leave with
 * nothing written. It closes as soon as the save has worked, and never because of what the preview says
 * afterwards: the save refreshes the preview too, which would read "Nothing to refresh" before the dialog had
 * gone, so the diff Apply was pressed on stays on screen until it goes. A failed save says one fixed sentence
 * under the header and leaves Apply ready to press again. Offline, Apply says it is disabled and does
 * nothing. No failure is ever shown as its own text, since it can quote a recipe.
 */
export function RecipeRefreshDialog({ open, recipeId, onClose }: RecipeRefreshDialogProps) {
  // Mounted only while open, so the preview is read afresh by each open and kept by none.
  return open ? <OpenRecipeRefreshDialog recipeId={recipeId} onClose={onClose} /> : null;
}
