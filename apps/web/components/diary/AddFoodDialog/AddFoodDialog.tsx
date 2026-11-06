"use client";

import { useProfileTimeZone } from "@keylow/api-client";
import {
  ADD_FOOD_DIALOG,
  PLATE,
  describeAddedToPlate,
  describeLastLogged,
  describeLoggedAmount,
} from "@keylow/core/copy";
import { describeDay } from "@keylow/core/dates";
import {
  plateItemOfHit,
  plateItemOfPickedFood,
  plateItemOfRecent,
  plateItemOfRecipe,
} from "@keylow/core/plate";
import { useEffect, useRef, useState } from "react";

import { DiscardPlateDialog } from "./DiscardPlateDialog";
import { LogPlateButton } from "./LogPlateButton";
import { PlateStrip } from "./PlateStrip";
import { PortionStep } from "./PortionStep";
import { RecipePortionStep } from "./RecipePortionStep";
import { SearchStep } from "./SearchStep";
import { useAmountDraft } from "./useAmountDraft";
import { useRecipePortionDraft } from "./useRecipePortionDraft";

import type { AddFoodDialogProps } from "./types";
import type { PlateItemBuilder } from "@/lib/plate";
import type { FoodSearchHit, RecentFood, RecipeSummary } from "@keylow/api-client";

import {
  DIARY_DIALOG_CLASSES,
  DIARY_RECIPE_AMOUNT_DIALOG_CLASSES,
} from "@/components/diary/diaryDialogClasses";
import { QuickAddDialog } from "@/components/diary/QuickAddDialog";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PlateChip } from "@/components/ui/PlateChip";
import { useFavouriteFoodHeart, useFavouriteRecipeHeart } from "@/lib/favourites";
import {
  PlateProvider,
  useLogPlate,
  usePlate,
  usePlateClockTime,
  usePlateDayBars,
} from "@/lib/plate";

/**
 * The add food dialog. Food goes on a plate and is logged all at once: the plate has one time, which starts at
 * the hour an hour's plus asked for, or at "Now" (the moment Log is pressed), on the day on view. The first step
 * is the search, where a row's plus puts its serving on the plate, writes nothing and clears the field, so
 * several foods can be added, and the Recent foods, whose plus puts the amount last logged on the plate. A
 * press on a row goes to the amount step, where Add to plate puts the chosen amount on the plate and goes back
 * to the search: for a food its amount in a portion or grams, for a recipe servings or grams of cooked weight.
 * With food on the plate the footer has Log food or Log foods, which writes every row in one go and closes the
 * dialog, and leaving the dialog asks "Discard your plate?". Quick add logs straight away and never goes on the plate.
 */
export function AddFoodDialog(props: AddFoodDialogProps) {
  return (
    <PlateProvider initialTime={props.request.time}>
      <AddFoodDialogContent {...props} />
    </PlateProvider>
  );
}

function AddFoodDialogContent({
  request,
  opener,
  onClose,
  onHoldsPlateChange,
}: AddFoodDialogProps) {
  const plate = usePlate();
  const { time, isNow } = usePlateClockTime();
  const [query, setQuery] = useState("");
  // The food the amount step is for. `recent` is set when it was chosen from Recent: its amount opens at
  // the one last logged, and a line says when.
  const [chosen, setChosen] = useState<{ foodId: string; recent?: RecentFood } | undefined>(
    request.foodId === undefined ? undefined : { foodId: request.foodId },
  );
  const foodId = chosen?.foodId;
  const recent = chosen?.recent;
  const timeZone = useProfileTimeZone().data ?? "UTC";
  // The moment the dialog opened, so "yesterday" does not move while it is open.
  const [openedAt] = useState(() => new Date());
  const [recipe, setRecipe] = useState<RecipeSummary | undefined>(undefined);
  const [isAsking, setIsAsking] = useState(false);
  // The Quick add row that opened the form, which focus goes back to when the form closes.
  const [quickAddOpener, setQuickAddOpener] = useState<Element | null | undefined>(undefined);
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });
  const searchField = useRef<HTMLInputElement>(null);
  const amountField = useRef<HTMLInputElement>(null);
  const logButton = useRef<HTMLButtonElement>(null);

  const draft = useAmountDraft(foodId, recent);
  const recipeDraft = useRecipePortionDraft(recipe);
  const foodHeart = useFavouriteFoodHeart(draft.status === "ready" ? draft.food : undefined);
  const recipeHeart = useFavouriteRecipeHeart(recipeDraft?.recipe);
  const isAmountReady = draft.status === "ready" || recipeDraft !== undefined;
  const isAmountStep = foodId !== undefined || recipe !== undefined;
  const { logPlate, canLog } = useLogPlate(request.date, onClose);
  const dayBars = usePlateDayBars(request.date);

  // Tells the page that owns the dialog whether a plate is held, and that none is once the dialog goes.
  useEffect(() => {
    onHoldsPlateChange?.(plate.count > 0);

    return () => {
      onHoldsPlateChange?.(false);
    };
  }, [plate.count, onHoldsPlateChange]);

  // The cursor starts where the step's work is: in the search, and in the amount once a food or a recipe is chosen.
  useEffect(() => {
    if (foodId === undefined && recipe === undefined) {
      searchField.current?.focus();
    } else if (isAmountReady) {
      amountField.current?.focus();
    }
  }, [foodId, recipe, isAmountReady]);

  // The log button, the close button and the pluses go inert while the plate is written, so a keyboard user's
  // focus must not stay on one of them: Shift+Tab from a disabled control can leave the dialog. Focus moves to
  // the search field when the log starts, and back to the log button if it failed and can be pressed again.
  const wasLogging = useRef(false);
  useEffect(() => {
    if (plate.isLogging) {
      searchField.current?.focus();
    } else if (wasLogging.current) {
      logButton.current?.focus();
    }
    wasLogging.current = plate.isLogging;
  }, [plate.isLogging]);

  function openRecent(food: RecentFood) {
    setChosen({ foodId: food.foodId, recent: food });
  }

  // Closing with food on the plate asks first. A close during a log is blocked by the dialog itself.
  function requestClose() {
    if (plate.count > 0) {
      setIsAsking(true);
    } else {
      onClose();
    }
  }

  // Every way of putting a food on the plate: nothing is written, no toast is drawn, the field is cleared and
  // a screen reader is told instead.
  function addToPlate(name: string, build: PlateItemBuilder) {
    plate.add(build);
    setQuery("");
    setChosen(undefined);
    setRecipe(undefined);
    setAnnouncement((previous) => ({
      text: describeAddedToPlate(name),
      count: previous.count + 1,
    }));
  }

  function addPickedFood() {
    if (draft.status !== "ready" || draft.needsReview) {
      return;
    }
    const { food, portions } = draft;
    const { amount } = draft.preview;
    if (amount === null) {
      return;
    }
    addToPlate(food.name, (key) => plateItemOfPickedFood({ key, food, portions, amount }));
  }

  function addPickedRecipe() {
    if (recipeDraft?.typed == null) {
      return;
    }
    const { amount } = recipeDraft.typed;
    addToPlate(recipeDraft.recipe.name, (key) =>
      plateItemOfRecipe({ key, recipe: recipeDraft.recipe, amount }),
    );
  }

  function addFromAmountStep() {
    if (recipeDraft !== undefined) {
      addPickedRecipe();
    } else {
      addPickedFood();
    }
  }

  async function handleLog() {
    if (!canLog) {
      return;
    }
    await logPlate();
  }

  const lastLoggedLine = (() => {
    if (recent === undefined) {
      return undefined;
    }
    const day = describeDay(new Date(recent.loggedAt), openedAt, timeZone);

    return describeLastLogged(describeLoggedAmount(recent.snapshot), -day.daysFromToday, day.label);
  })();

  // What the footer's Add to plate needs to know of the step on show. The search has none.
  const canAddToPlate =
    recipeDraft !== undefined
      ? recipeDraft.typed !== null
      : draft.status === "ready" && draft.preview.amount !== null && !draft.needsReview;

  function backToResults() {
    setChosen(undefined);
    setRecipe(undefined);
  }

  const footer = isAmountStep ? (
    <>
      <Button
        type="button"
        variant="ghost"
        className="text-label-small text-text-secondary"
        onClick={backToResults}
      >
        {ADD_FOOD_DIALOG.cancel}
      </Button>
      <Button type="button" disabled={!canAddToPlate} onClick={addFromAmountStep}>
        {PLATE.addToPlate}
      </Button>
    </>
  ) : (
    <>
      <Button
        type="button"
        variant="ghost"
        className="text-label-small text-text-secondary"
        disabled={plate.isLogging}
        onClick={requestClose}
      >
        {ADD_FOOD_DIALOG.cancel}
      </Button>
      {plate.count > 0 && (
        <LogPlateButton
          count={plate.count}
          canLog={canLog}
          isLogging={plate.isLogging}
          buttonRef={logButton}
          onPress={() => {
            void handleLog();
          }}
        />
      )}
    </>
  );

  return (
    <>
      <Dialog
        open
        className={
          recipeDraft === undefined ? DIARY_DIALOG_CLASSES : DIARY_RECIPE_AMOUNT_DIALOG_CLASSES
        }
        returnFocusTo={opener}
        onClose={requestClose}
        closeDisabled={plate.isLogging}
        title={ADD_FOOD_DIALOG.title}
        headerAction={
          <PlateChip
            count={plate.count}
            // Your plate opens from this chip in a later change. Until then it shows the count and does nothing.
            onPress={() => undefined}
            disabled={plate.isLogging || isAmountStep}
          />
        }
        strip={dayBars.status === "unavailable" ? undefined : <PlateStrip dayBars={dayBars} />}
        footer={footer}
      >
        <div className="flex flex-col gap-3">
          {recipeDraft !== undefined ? (
            <RecipePortionStep
              draft={recipeDraft}
              amountRef={amountField}
              favouriteHeart={recipeHeart}
              onBack={backToResults}
            />
          ) : foodId === undefined ? (
            <SearchStep
              query={query}
              onQueryChange={setQuery}
              time={time}
              isNow={isNow}
              onTimeChange={(chosenTime) => {
                plate.setTime({ isNow: false, time: chosenTime });
              }}
              isLogging={plate.isLogging}
              searchRef={searchField}
              onOpenFood={(id) => {
                setChosen({ foodId: id });
              }}
              onOpenRecent={openRecent}
              onAddRecent={(food) => {
                addToPlate(food.snapshot.name, (key) => plateItemOfRecent(key, food));
              }}
              onOpenRecipe={setRecipe}
              onAddServing={(hit: FoodSearchHit) => {
                addToPlate(hit.name, (key) => plateItemOfHit(key, hit));
              }}
              onAddRecipeServing={(chosenRecipe) => {
                addToPlate(chosenRecipe.name, (key) =>
                  plateItemOfRecipe({ key, recipe: chosenRecipe }),
                );
              }}
              onQuickAdd={() => {
                setQuickAddOpener(document.activeElement);
              }}
            />
          ) : (
            <PortionStep
              draft={draft}
              note={lastLoggedLine}
              // The review link leaves this page, which would drop the plate, so it opens in a new tab.
              opensReviewInNewTab={plate.count > 0}
              favouriteHeart={foodHeart}
              amountRef={amountField}
              onBack={backToResults}
            />
          )}
          {/* One live region that stays in the page, so its changes are announced. The same food added twice
              alternates a no-break space on the end, which a screen reader does not read but which is a change. */}
          <p role="status" className="sr-only">
            {announcement.count % 2 === 0 ? announcement.text : `${announcement.text}\u00A0`}
          </p>
        </div>
      </Dialog>
      {quickAddOpener !== undefined && (
        <QuickAddDialog
          request={request}
          opener={quickAddOpener}
          onClose={() => {
            setQuickAddOpener(undefined);
          }}
          // The plate is never lost by Quick add: with food on it the search comes back as it was, and with
          // none there is nothing to come back to, so everything closes, as the phone's quick add does.
          onLogged={
            plate.count > 0
              ? () => {
                  setQuickAddOpener(undefined);
                }
              : onClose
          }
        />
      )}
      <DiscardPlateDialog
        open={isAsking}
        count={plate.count}
        onKeepAdding={() => {
          setIsAsking(false);
        }}
        onDiscard={onClose}
      />
    </>
  );
}
