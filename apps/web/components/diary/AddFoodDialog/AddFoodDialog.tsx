"use client";

import { useProfileTimeZone } from "@keylow/api-client";
import { describeInLogOpening, resolveAssistantTimeZone } from "@keylow/core";
import {
  ADD_FOOD_DIALOG,
  ENTRY_SCREEN,
  OFFLINE_BANNER,
  PLATE,
  UNDO_LABEL,
  describeAddedToPlate,
  describeLastLogged,
  describeLoggedAmount,
} from "@keylow/core/copy";
import { describeDay, toLocalDate } from "@keylow/core/dates";
import {
  plateItemOfHit,
  plateItemOfPickedFood,
  plateItemOfRecent,
  plateItemOfRecipe,
  plateRecipeOfRow,
  plateRecipeRowStart,
} from "@keylow/core/plate";
import { WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BackToResults } from "./BackToResults";
import { DiscardPlateDialog } from "./DiscardPlateDialog";
import { LogPlateButton } from "./LogPlateButton";
import { PlatePanel } from "./PlatePanel";
import { PlateStrip } from "./PlateStrip";
import { PortionStep } from "./PortionStep";
import { RecipePortionStep } from "./RecipePortionStep";
import { SearchStep } from "./SearchStep";
import { useAmountDraft } from "./useAmountDraft";
import { useRecipePortionDraft } from "./useRecipePortionDraft";

import type { AddFoodDialogProps } from "./types";
import type { PlateItemBuilder } from "@/lib/plate";
import type { FoodSearchHit, RecentFood, RecipeSummary } from "@keylow/api-client";
import type { PlateFoodItem, PlateItem } from "@keylow/core/plate";

import {
  DIARY_DIALOG_CLASSES,
  DIARY_PLATE_COLUMN_DIALOG_CLASSES,
  DIARY_RECIPE_AMOUNT_DIALOG_CLASSES,
} from "@/components/diary/diaryDialogClasses";
import { QuickAddDialog } from "@/components/diary/QuickAddDialog";
import { useBarcodeSearch } from "@/components/foods/BarcodeLookup";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PlateChip } from "@/components/ui/PlateChip";
import { useToast } from "@/components/ui/Toast";
import { useFavouriteFoodHeart, useFavouriteRecipeHeart } from "@/lib/favourites";
import { useKeyboardUndo } from "@/lib/keyboardUndo";
import {
  PlateProvider,
  useIsPlateColumn,
  useLogPlate,
  usePlate,
  usePlateClockTime,
  usePlateDayBars,
} from "@/lib/plate";
import { useIsOnline } from "@/lib/useIsOnline";
import { cn } from "@/lib/utils";

/**
 * The add food dialog. Food goes on a plate and is logged all at once: the plate has one time, which starts at
 * the hour an hour's plus asked for, or at "Now" (the moment Log is pressed), on the day on view. The first step
 * is the search, where a row's plus puts its serving on the plate, writes nothing and clears the field, so
 * several foods can be added, and the Recent foods, whose plus puts the amount last logged on the plate. A
 * press on a row goes to the amount step, where Add to plate puts the chosen amount on the plate and goes back
 * to the search: for a food its amount in a portion or grams, for a recipe servings or grams of cooked weight.
 * With food on the plate the footer has Log food or Log foods, which writes every row in one go and closes the
 * dialog, and leaving the dialog asks "Discard your plate?". Quick add logs straight away and never goes on the plate.
 *
 * The chip in the header opens Your plate, and never anything else does: from 1024 px a 400 px column beside the
 * results in a dialog grown to 960, and below that a step of the dialog in place of the search. A row's name there
 * opens the amount step on that row (Save puts it back in place). The amount step always draws in the 560
 * dialog, and an open Your plate comes back when it ends.
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
  onDescribe,
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
  const profileTimeZone = useProfileTimeZone();
  const timeZone = profileTimeZone.data ?? "UTC";
  // The moment the dialog opened, so "yesterday" does not move while it is open.
  const [openedAt] = useState(() => new Date());
  const [recipe, setRecipe] = useState<RecipeSummary | undefined>(undefined);
  // What the "Discard your plate?" question is asked for: leaving the dialog, or describing a meal to the assistant.
  const [asking, setAsking] = useState<"leave" | "describe" | undefined>(undefined);
  // The Quick add row that opened the form, which focus goes back to when the form closes.
  const [quickAddOpener, setQuickAddOpener] = useState<Element | null | undefined>(undefined);
  // Your plate is open: the person pressed the chip. It is not shown once the plate is empty, and Undo does not reopen it.
  const [isPlateOpen, setIsPlateOpen] = useState(false);
  // The plate row the amount step is editing.
  const [editedKey, setEditedKey] = useState<string | undefined>(undefined);
  // The sentence of a log that failed while Your plate was open, drawn in its banner until the panel closes.
  const [logRefusal, setLogRefusal] = useState<string | undefined>(undefined);
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });
  const searchField = useRef<HTMLInputElement>(null);
  const amountField = useRef<HTMLInputElement>(null);
  const logButton = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const chipButton = useRef<HTMLButtonElement>(null);
  // Where focus goes once the next render has drawn it, for a control that is not there yet or has just gone.
  const focusRequest = useRef<
    "heading" | "chip" | "search" | { row: number; control: "amount" | "remove" } | undefined
  >(undefined);
  // Set when an edit ends, so the effect that focuses the search leaves the edited row's field alone.
  const keepsFocusOnRow = useRef(false);
  const isClearToastUp = useRef(false);
  const toast = useToast();
  const keyboardUndo = useKeyboardUndo();
  const isOnline = useIsOnline();
  const isColumn = useIsPlateColumn();

  // The row the amount step edits is read from the plate as it is, so it is the row's own amount and unit that open.
  const editedRow = plate.items.find((item) => item.key === editedKey);
  const editedFoodRow: PlateFoodItem | undefined =
    editedRow?.kind === "food" ? editedRow : undefined;
  // A recipe row is edited from what the row stored, which is what logging it writes, so no read of the recipe is needed.
  const editedRecipeRow = editedRow?.kind === "recipe" ? editedRow : undefined;
  const recipeForDraft = recipe ?? (editedRecipeRow && plateRecipeOfRow(editedRecipeRow));
  const editedRecipeStart = editedRecipeRow && plateRecipeRowStart(editedRecipeRow);
  const { barcodeButton, barcodePanel } = useBarcodeSearch({
    searchField,
    keeps: "plate",
    onFound: (food) => {
      setChosen({ foodId: food.id });
    },
  });
  const draft = useAmountDraft(foodId, recent, editedFoodRow);
  const recipeDraft = useRecipePortionDraft(recipeForDraft, editedRecipeStart);
  const foodHeart = useFavouriteFoodHeart(draft.status === "ready" ? draft.food : undefined);
  const recipeHeart = useFavouriteRecipeHeart(recipe);
  const isAmountReady = draft.status === "ready" || recipeDraft !== undefined;
  const isAmountStep = foodId !== undefined || recipe !== undefined || editedRow !== undefined;
  const isEditing = editedRow !== undefined;
  const showsPlate = isPlateOpen && plate.count > 0;
  const hasColumns = showsPlate && isColumn && !isAmountStep;
  const showsPlateStep = showsPlate && !isColumn && !isAmountStep;
  // A plate that is logged takes the dialog with it, and with it a toast whose Undo has nothing to put back.
  const { logPlate, canLog } = useLogPlate(request.date, () => {
    isClearToastUp.current = false;
    onClose();
  });
  const dayBars = usePlateDayBars(request.date);

  // Tells the page that owns the dialog whether a plate is held, and that none is once the dialog goes.
  useEffect(() => {
    onHoldsPlateChange?.(plate.count > 0);

    return () => {
      onHoldsPlateChange?.(false);
    };
  }, [plate.count, onHoldsPlateChange]);

  // The cursor starts where the step's work is: in the search, and in the amount once a food or a recipe is
  // chosen. When an edit has just ended, Your plate comes back with the row's amount field focused instead.
  useEffect(() => {
    if (!isAmountStep) {
      if (keepsFocusOnRow.current) {
        keepsFocusOnRow.current = false;
      } else {
        searchField.current?.focus();
      }
    } else if (isAmountReady) {
      amountField.current?.focus();
    }
  }, [isAmountStep, isAmountReady]);

  // The window crossing 1024 px draws Your plate again, as a column or a step, and a focus that was inside it
  // is lost to the page. It goes to the heading.
  const wasColumn = useRef(isColumn);
  useEffect(() => {
    if (wasColumn.current === isColumn) {
      return;
    }
    wasColumn.current = isColumn;
    const isFocusLost = document.activeElement === null || document.activeElement === document.body;
    if (showsPlate && !isAmountStep && isFocusLost) {
      headingRef.current?.focus();
    }
  }, [isColumn, showsPlate, isAmountStep]);

  // What a focus request points at. A row is told by its place in the list, which is the place the removed row had.
  function elementToFocus(target: NonNullable<typeof focusRequest.current>) {
    if (target === "heading") return headingRef.current;
    if (target === "chip") return chipButton.current;
    if (target === "search") return searchField.current;

    const row = headingRef.current
      ?.closest("section")
      ?.querySelectorAll("ul > li")
      .item(target.row);

    // A removal goes to the row's Remove button, named by describeRemoveFromPlate, so a tap raises no soft keyboard.
    return target.control === "amount"
      ? row?.querySelector<HTMLElement>("input")
      : row?.querySelector<HTMLElement>('button[aria-label^="Remove "]');
  }

  // A focus the handlers asked for, once the render they caused has drawn the control: the heading of Your
  // plate when it opens, the chip when it closes, and the search after Clear plate or the last row.
  useEffect(() => {
    const target = focusRequest.current;
    const element = target === undefined ? null : elementToFocus(target);
    if (element !== null && element !== undefined) {
      focusRequest.current = undefined;
      element.focus();
    }
  });

  // The log button, the close button and the pluses go inert while the plate is written, so a keyboard user's
  // focus must not stay on one of them: Shift+Tab from a disabled control can leave the dialog. Focus moves to
  // the search field when the log starts, or to the heading of Your plate when that is what is on show (the
  // step form has no search), and back to the log button if it failed and can be pressed again.
  const wasLogging = useRef(false);
  useEffect(() => {
    if (plate.isLogging) {
      (searchField.current ?? headingRef.current)?.focus();
    } else if (wasLogging.current) {
      logButton.current?.focus();
    }
    wasLogging.current = plate.isLogging;
  }, [plate.isLogging]);

  // The Undo of Plate cleared works on this dialog's plate, so it goes with the dialog.
  useEffect(
    () => () => {
      if (isClearToastUp.current) {
        toast.dismiss();
      }
    },
    [toast],
  );

  function openRecent(food: RecentFood) {
    setChosen({ foodId: food.foodId, recent: food });
  }

  // Closing with food on the plate asks first. A close during a log is blocked by the dialog itself.
  function requestClose() {
    if (plate.count > 0) {
      setAsking("leave");
    } else {
      onClose();
    }
  }

  // The assistant opens in the dialog's place and logs to the day and time being logged. A plate cannot
  // travel there, so with food on it the person is asked first, as for any other way of leaving.
  function openDescribe() {
    if (plate.count > 0) {
      setAsking("describe");
    } else {
      describeMeal();
    }
  }

  function describeMeal() {
    const assistantZone = resolveAssistantTimeZone(
      profileTimeZone.data,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    const day = request.date ?? toLocalDate(new Date(), assistantZone);
    // The time is the plate's, which is the hour's plus until the person changes it. Now stays the clock's.
    onDescribe?.(describeInLogOpening(isNow ? { day } : { day, time }, new Date(), assistantZone));
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
    setLogRefusal(undefined);
    // With Your plate open the failure is its banner's, and with it closed it is a toast.
    const showsFailureToast = !showsPlate;
    const result = await logPlate({ showsFailureToast });
    // A log that put its own toast in the place of the Undo one has left nothing of this dialog's to dismiss.
    if (result.ok || (result.wasIgnored === undefined && showsFailureToast)) {
      isClearToastUp.current = false;
    }
    if (!result.ok && result.wasIgnored === undefined && showsPlate) {
      setLogRefusal(result.refusal);
    }
  }

  function openPlate() {
    setIsPlateOpen(true);
    focusRequest.current = "heading";
  }

  // The chip and the Results link close it, and the focus goes back to the chip.
  function closePlate() {
    setIsPlateOpen(false);
    setLogRefusal(undefined);
    focusRequest.current = "chip";
  }

  // Both leave the chip behind, so the focus goes to the search.
  function leavePlateEmpty() {
    setIsPlateOpen(false);
    setLogRefusal(undefined);
    focusRequest.current = "search";
  }

  function removeRow(key: string) {
    const index = plate.items.findIndex((item) => item.key === key);
    plate.remove(key);
    if (plate.count === 1) {
      leavePlateEmpty();
    } else {
      // The remove button goes with its row, so the focus goes to the Remove button of the row that took its
      // place, or of the one before it when the last row was removed.
      focusRequest.current = { row: Math.min(index, plate.count - 2), control: "remove" };
    }
  }

  function clearPlate() {
    // Asked as the press arrives, while focus is still on Clear plate, and settled once the panel has gone.
    const keyboardRoute = keyboardUndo.afterPressingButton({ returnTo: () => searchField.current });
    plate.clear();
    leavePlateEmpty();
    isClearToastUp.current = true;
    toast.show({
      message: PLATE.cleared,
      icon: X,
      actionLabel: UNDO_LABEL,
      onAction: () => {
        isClearToastUp.current = false;
        plate.restore();
      },
      ...keyboardRoute(),
    });
  }

  function openRow(item: PlateItem) {
    setEditedKey(item.key);
    if (item.kind === "food") {
      setChosen({ foodId: item.foodId });
    }
  }

  // The step ends: Your plate comes back if it was open, with the edited row's amount field focused.
  function endEdit(key: string) {
    setEditedKey(undefined);
    // Your plate comes back with the edited row's amount field focused, once.
    keepsFocusOnRow.current = true;
    focusRequest.current = {
      row: plate.items.findIndex((item) => item.key === key),
      control: "amount",
    };
    setChosen(undefined);
    setRecipe(undefined);
  }

  function saveEdit() {
    if (editedRow === undefined) {
      return;
    }
    if (editedRow.kind === "recipe") {
      if (recipeDraft?.typed == null) {
        return;
      }
      const { amount } = recipeDraft.typed;
      const { recipe: editedRecipe } = recipeDraft;
      plate.replace(editedRow.key, (key) =>
        plateItemOfRecipe({ key, recipe: editedRecipe, amount }),
      );
    } else {
      if (draft.status !== "ready" || draft.needsReview || draft.preview.amount === null) {
        return;
      }
      const { food, portions } = draft;
      const { amount } = draft.preview;
      plate.replace(editedRow.key, (key) => plateItemOfPickedFood({ key, food, portions, amount }));
    }
    endEdit(editedRow.key);
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

  // Cancel and the Results link on the amount step go back and never ask: to the search, or in an edit to Your plate.
  function backToResults() {
    if (editedRow !== undefined) {
      endEdit(editedRow.key);
    } else {
      setChosen(undefined);
      setRecipe(undefined);
    }
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
      <Button
        type="button"
        disabled={!canAddToPlate}
        onClick={isEditing ? saveEdit : addFromAmountStep}
      >
        {isEditing ? ENTRY_SCREEN.saveAction : PLATE.addToPlate}
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

  const searchStep = (
    <SearchStep
      query={query}
      onQueryChange={setQuery}
      time={time}
      isNow={isNow}
      hidesTime={showsPlate}
      onTimeChange={(chosenTime) => {
        plate.setTime({ isNow: false, time: chosenTime });
      }}
      isLogging={plate.isLogging}
      searchRef={searchField}
      barcodeButton={barcodeButton}
      barcodePanel={barcodePanel}
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
        addToPlate(chosenRecipe.name, (key) => plateItemOfRecipe({ key, recipe: chosenRecipe }));
      }}
      onQuickAdd={() => {
        setQuickAddOpener(document.activeElement);
      }}
      onDescribe={onDescribe === undefined ? undefined : openDescribe}
    />
  );

  // Under 1024 the search is out of view while Your plate is, so its offline note comes with the panel.
  const plateNotice = (
    <>
      {!isColumn && !isOnline && (
        <Banner title={OFFLINE_BANNER.title} icon={WifiOff}>
          {PLATE.offlineBody}
        </Banner>
      )}
      {logRefusal !== undefined && (
        <Banner tone="error" sentence>
          {logRefusal}
        </Banner>
      )}
    </>
  );

  const plateRows = (
    <PlatePanel
      items={plate.items}
      dayBars={
        dayBars.status === "ready" ? { dayTitle: dayBars.dayTitle, bars: dayBars.bars } : undefined
      }
      time={time}
      isNow={isNow}
      onTimeChange={(chosenTime) => {
        plate.setTime({ isNow: false, time: chosenTime });
      }}
      onAmountChange={plate.setQuantity}
      onRemove={removeRow}
      onClear={clearPlate}
      onOpenRow={openRow}
      isOpenDisabled={!isOnline}
      isLogging={plate.isLogging}
      headingRef={headingRef}
      notice={plateNotice}
      resultsLink={
        isColumn ? <BackToResults onClick={closePlate} disabled={plate.isLogging} /> : undefined
      }
    />
  );

  const amountStep =
    recipeDraft !== undefined ? (
      <RecipePortionStep
        draft={recipeDraft}
        amountRef={amountField}
        favouriteHeart={isEditing ? undefined : recipeHeart}
        backLabel={isEditing ? PLATE.title : undefined}
        onBack={backToResults}
      />
    ) : (
      <PortionStep
        draft={draft}
        note={lastLoggedLine}
        // The review link leaves this page, which would drop the plate, so it opens in a new tab.
        opensReviewInNewTab={plate.count > 0}
        favouriteHeart={isEditing ? undefined : foodHeart}
        amountRef={amountField}
        backLabel={isEditing ? PLATE.title : undefined}
        onBack={backToResults}
      />
    );

  return (
    <>
      <Dialog
        open
        className={cn(
          recipeDraft === undefined ? DIARY_DIALOG_CLASSES : DIARY_RECIPE_AMOUNT_DIALOG_CLASSES,
          hasColumns && DIARY_PLATE_COLUMN_DIALOG_CLASSES,
        )}
        returnFocusTo={opener}
        onClose={requestClose}
        closeDisabled={plate.isLogging}
        title={ADD_FOOD_DIALOG.title}
        headerAction={
          <PlateChip
            buttonRef={chipButton}
            count={plate.count}
            isExpanded={showsPlate}
            onPress={showsPlate ? closePlate : openPlate}
            // A draft must not be lost to the panel, so the chip is inert on the amount step.
            disabled={plate.isLogging || isAmountStep}
          />
        }
        // While Your plate is open its totals card draws the bars, so the strip would show them twice.
        strip={
          dayBars.status === "unavailable" || (showsPlate && !isAmountStep) ? undefined : (
            <PlateStrip dayBars={dayBars} />
          )
        }
        bodyPadding={!hasColumns}
        footer={footer}
      >
        {/* One live region that stays in the page, so its changes are announced. The same food added twice
            alternates a no-break space on the end, which a screen reader does not read but which is a change. */}
        <p role="status" className="sr-only">
          {announcement.count % 2 === 0 ? announcement.text : `${announcement.text}\u00A0`}
        </p>
        {hasColumns ? (
          <div className="flex h-full min-h-0">
            <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
              {searchStep}
            </div>
            <div className="flex w-[400px] shrink-0 flex-col border-l border-border p-5">
              {plateRows}
            </div>
          </div>
        ) : (
          // The step fills the body, so its rows scroll and its Time row stays in reach.
          <div className={cn("flex flex-col gap-3", showsPlateStep && "h-full")}>
            {isAmountStep ? (
              amountStep
            ) : showsPlateStep ? (
              <>
                <BackToResults onClick={closePlate} disabled={plate.isLogging} />
                {plateRows}
              </>
            ) : (
              searchStep
            )}
          </div>
        )}
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
          onLogged={() => {
            // Its toast has taken the place of the Undo one.
            isClearToastUp.current = false;
            if (plate.count > 0) {
              setQuickAddOpener(undefined);
            } else {
              onClose();
            }
          }}
        />
      )}
      <DiscardPlateDialog
        open={asking !== undefined}
        count={plate.count}
        onKeepAdding={() => {
          setAsking(undefined);
        }}
        onDiscard={
          asking === "describe"
            ? () => {
                setAsking(undefined);
                describeMeal();
              }
            : onClose
        }
      />
    </>
  );
}
