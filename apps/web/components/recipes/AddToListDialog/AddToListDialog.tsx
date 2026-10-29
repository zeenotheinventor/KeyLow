"use client";

import { useAddRecipesToList, useShoppingPreview } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  RECIPE_EDITOR,
  RECIPE_VIEW,
  RETRY_LABEL,
  SHOPPING_LIST,
  describeAddAnyway,
  describeLeftOutCount,
  describeServingsValue,
  describeShoppingAmount,
} from "@keylow/core/copy";
import { enteredViewServings, stepViewServings } from "@keylow/core/recipes";
import { Check, CircleAlert } from "lucide-react";
import { useState } from "react";

import type { AddToListDialogProps, AddToListRecipe } from "./types";
import type { ServingsStepDirection } from "@/components/ui/ServingsStepper";
import type { ShoppingDraft } from "@keylow/core/shopping";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { GroupedList } from "@/components/ui/GroupedList";
import { ServingsStepper } from "@/components/ui/ServingsStepper";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useIsOnline } from "@/lib/useIsOnline";

const amountOf = (draft: ShoppingDraft): string | null =>
  describeShoppingAmount({
    grams: draft.grams,
    portion_label: draft.portionLabel,
    portion_count: draft.portionCount,
  });

function DraftText({ draft }: { draft: ShoppingDraft }) {
  const amount = amountOf(draft);

  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-[14px] font-semibold leading-5">{draft.name}</span>
      {amount !== null && <span className="text-caption text-text-muted">{amount}</span>}
    </span>
  );
}

type BodyProps = {
  recipe: AddToListRecipe;
  initialServings: number;
  onClose: () => void;
  open: boolean;
};

function AddToListBody({ recipe, initialServings, onClose, open }: BodyProps) {
  const isOnline = useIsOnline();
  const toast = useToast();
  const add = useAddRecipesToList();
  const [servings, setServings] = useState(initialServings);
  const [text, setText] = useState(String(initialServings));
  const [hasProblem, setHasProblem] = useState(false);
  // The staples the person chose to add anyway, by food. Nothing is kept once the dialog closes.
  const [addAnyway, setAddAnyway] = useState<readonly string[]>([]);
  const state = useShoppingPreview([{ id: recipe.id, servings }], { enabled: open });

  function choose(next: number) {
    setServings(next);
    setText(String(next));
    setHasProblem(false);
  }

  function handleStep(direction: ServingsStepDirection) {
    const next = stepViewServings(servings, direction === 1 ? "plus" : "minus");
    if (next !== null) {
      choose(next);
    }
  }

  function handleChangeText(typed: string) {
    setText(typed);
    const entered = enteredViewServings(typed, recipe.servings);
    setHasProblem(entered === null);
    if (entered !== null) {
      setServings(entered);
    }
  }

  function toggleStaple(foodId: string, checked: boolean) {
    setAddAnyway((chosen) =>
      checked ? [...chosen, foodId] : chosen.filter((chosenId) => chosenId !== foodId),
    );
  }

  const preview = state.status === "ready" ? state.preview : null;
  const chosenStaples = preview?.staples.filter(({ foodId }) => addAnyway.includes(foodId)) ?? [];
  const isNothingToAdd = preview === null || preview.items.length + chosenStaples.length === 0;

  function submit() {
    add.mutate(
      {
        recipes: [{ id: recipe.id, servings }],
        addAnyway: chosenStaples.map(({ foodId }) => foodId),
      },
      {
        onSuccess: () => {
          toast.show({ message: SHOPPING_LIST.added, icon: Check, tone: "success" });
          onClose();
        },
        onError: () => {
          toast.show({ message: SHOPPING_LIST.addFailed, icon: CircleAlert, tone: "danger" });
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={SHOPPING_LIST.addToList}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {SHOPPING_LIST.cancel}
          </Button>
          <Button
            type="button"
            loading={add.isPending}
            disabled={!isOnline || isNothingToAdd || hasProblem}
            onClick={submit}
          >
            {SHOPPING_LIST.addToList}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body-strong">{recipe.name}</p>
        <ServingsStepper
          label={RECIPE_EDITOR.servings}
          decreaseLabel={RECIPE_VIEW.fewerServings}
          increaseLabel={RECIPE_VIEW.moreServings}
          text={text}
          onChangeText={handleChangeText}
          value={servings}
          valueText={describeServingsValue(servings)}
          canDecrease={stepViewServings(servings, "minus") !== null}
          canIncrease={stepViewServings(servings, "plus") !== null}
          onStep={handleStep}
          error={hasProblem ? RECIPE_VIEW.servingsProblem : undefined}
          onBlur={() => {
            setText(String(servings));
            setHasProblem(false);
          }}
        />

        {state.status === "loading" && <Skeleton variant="rows" count={3} />}

        {state.status === "error" && (
          <ErrorState
            title={GENERIC_ERROR}
            retryLabel={RETRY_LABEL}
            onRetry={state.retry}
            size="section"
            headingLevel={2}
          />
        )}

        {preview !== null && preview.items.length === 0 && (
          <p className="text-body text-text-secondary">{SHOPPING_LIST.onlyStaples}</p>
        )}

        {preview !== null && preview.items.length > 0 && (
          <GroupedList title={SHOPPING_LIST.toBuy} headerSize="compact">
            {preview.items.map((draft) => (
              <li key={draft.foodId} className="flex min-h-[52px] items-center px-3 py-2">
                <DraftText draft={draft} />
              </li>
            ))}
          </GroupedList>
        )}

        {preview !== null && preview.staples.length > 0 && (
          <GroupedList
            title={SHOPPING_LIST.leftOut}
            headerSize="compact"
            notice={
              <p className="px-1 text-caption text-text-muted">
                {describeLeftOutCount(preview.staples.length)}
              </p>
            }
          >
            {preview.staples.map((draft) => (
              <li key={draft.foodId} className="flex min-h-[52px] items-center gap-3 px-3 py-1">
                <DraftText draft={draft} />
                <Checkbox
                  label={SHOPPING_LIST.addAnyway}
                  aria-label={describeAddAnyway(draft.name)}
                  checked={addAnyway.includes(draft.foodId)}
                  onChange={(event) => {
                    toggleStaple(draft.foodId, event.target.checked);
                  }}
                />
              </li>
            ))}
          </GroupedList>
        )}
      </div>
    </Dialog>
  );
}

/**
 * Adds a recipe's ingredients to the shopping list, over the page it was opened from. It starts at the
 * servings it is given, and the stepper changes the amounts it shows and nothing else until Add is
 * pressed. The store cupboard staples are left out, listed under their own heading, and each can be
 * added anyway. What is a staple and how the amounts add up are core's. Add writes once, all or
 * nothing, says so in a toast and closes. A failure says so in a toast and keeps the dialog open.
 */
export function AddToListDialog({ open, recipe, initialServings, onClose }: AddToListDialogProps) {
  // Each opening starts afresh, at the servings it is given and with no staple added.
  const [openings, setOpenings] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpenings((count) => count + 1);
    }
  }

  return recipe === null ? null : (
    <AddToListBody
      key={`${recipe.id}:${openings}`}
      recipe={recipe}
      initialServings={initialServings}
      onClose={onClose}
      open={open}
    />
  );
}
