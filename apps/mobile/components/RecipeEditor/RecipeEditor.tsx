import { useCreateRecipe, useUpdateRecipe } from "@keylow/api-client";
import {
  ENTRY_SCREEN,
  FOOD_FORM,
  OFFLINE_BANNER,
  RECIPE_EDITOR,
  RECIPE_TOASTS,
  SAVE_FAILED_BANNER,
  problemSentences,
} from "@keylow/core/copy";
import {
  MAX_RECIPE_INGREDIENTS,
  isRecipeDraftChanged,
  newRecipeDraft,
  recipeCardOf,
  recipeDraftOf,
  validateRecipeDraft,
} from "@keylow/core/recipes";
import { useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { vars } from "nativewind";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useIngredientEdits } from "./useIngredientEdits";
import { useStepEdits } from "./useStepEdits";
import { useStepSheet } from "./useStepSheet";
import { useIsOnline } from "../../lib/connectivity";
import { dockBottomPadding } from "../../lib/dockBottomPadding";
import { recipePath, recipesPath } from "../../lib/recipeRoutes";
import { useKeyboardLift } from "../../lib/useKeyboardLift";
import { useScrollFocusedInputIntoView } from "../../lib/useScrollFocusedInputIntoView";
import { useSettledValue } from "../../lib/useSettledValue";
import { AddIngredientSheet } from "../AddIngredientSheet";
import { DiscardRecipeSheet } from "../DiscardRecipeSheet";
import { IngredientAmountStep } from "../IngredientAmountStep";
import { PerServingCard } from "../PerServingCard";
import { RecipeDetailsFields } from "../RecipeDetailsFields";
import { RecipeIngredientsSection } from "../RecipeIngredientsSection";
import { RecipeStepsSection } from "../RecipeStepsSection";
import { StepSheet } from "../StepSheet";
import { Banner, Button, SheetHeader, useToast, useToastAboveBar } from "../ui";

import type { RecipeEditorProps } from "./types";
import type { ChosenFood } from "../AddIngredientSheet";
import type { RecipeDetailsField } from "../RecipeDetailsFields";
import type { ProblemSentences } from "@keylow/core/copy";
import type { RecipeDraft, RecipeIngredient } from "@keylow/core/recipes";
import type {
  HostInstance,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TextInput,
} from "react-native";

// How long typing has to stop before the Per serving card follows it, and so before it is read out.
const CARD_FOLLOWS_TYPING_AFTER_MS = 500;

// How far above the top of the scroll view a field is left when Save scrolls to it.
const ROOM_ABOVE_PROBLEM = 16;

// How far above the bottom of the scroll view the end of the Ingredients is left after one is added.
const ROOM_BELOW_INGREDIENTS = 16;

type SaveStatus = "idle" | "saving" | "leaving";

/** Where the screen goes once nothing holds it back. A new recipe is replaced by its saved one, anything else is gone back to. */
type Exit = { href: string; how: "dismiss" | "replace" };

/**
 * The recipe editor: the details, the ingredients (each opens its amount step, in a page over the editor so
 * the draft and the scroll place stay where they are, and each can be removed with an Undo; Add ingredient
 * opens the food search over the editor the same way), the Instructions (a step opens a sheet over the editor,
 * and Reorder moves them up and down) and the Per serving card, which follows the servings, the cooked weight and the ingredients once typing stops. Save is always pressable (but
 * offline), and a failed one says what to fix, field by field, scrolls to the first and moves focus to it.
 * Leaving with changes asks first, by the header's Back or Close, the Android back button and the iOS swipe
 * back alike. It holds no sums of its own: the card, the checks, the sentences and what counts as a change
 * are core's.
 */
export function RecipeEditor({ existing, initialName }: RecipeEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();

  const [baseline, setBaseline] = useState<RecipeDraft>(() =>
    existing === undefined ? newRecipeDraft(initialName) : recipeDraftOf(existing),
  );
  const [draft, setDraft] = useState<RecipeDraft>(baseline);
  const [hasTriedToSave, setHasTriedToSave] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasSaveFailed, setHasSaveFailed] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [exit, setExit] = useState<Exit | null>(null);
  const isSavingNow = useRef(false);
  // The ingredient whose amount step is open, if one is. It is held as the ingredient and not as its place,
  // because the list can change under the step (an Undo puts a removed ingredient back above it).
  const [openStep, setOpenStep] = useState<{ ingredient: RecipeIngredient; id: number } | null>(
    null,
  );
  const stepCount = useRef(0);
  // The food search for a new ingredient, over the editor, and the food whose amount step it has open.
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [chosenFood, setChosenFood] = useState<ChosenFood | undefined>(undefined);
  const shouldFocusAddRow = useRef(false);
  const shouldScrollToAdded = useRef(false);
  const scrollOffset = useRef(0);
  const scrollViewportHeight = useRef(0);
  const [dockHeight, setDockHeight] = useState(0);
  const shouldFocusIngredientsHeading = useRef(false);

  const frameRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const nameField = useRef<TextInput>(null);
  const servingsField = useRef<TextInput>(null);
  const cookedWeightField = useRef<TextInput>(null);
  const ingredientsSection = useRef<View>(null);
  const ingredientsHeading = useRef<View>(null);
  const stepsHeading = useRef<View>(null);
  const addIngredientRow = useRef<View>(null);
  const ingredientLimitCaption = useRef<View>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard. iOS has the padding view.
  const keyboardLift = useKeyboardLift(frameRef, Platform.OS === "android");
  const trackScrollOffset = useScrollFocusedInputIntoView(scrollViewRef, keyboardLift);

  const ingredientEdits = useIngredientEdits(draft.ingredients, setDraft);
  const stepEdits = useStepEdits(draft.steps, setDraft);
  // A removed step leaves nothing to keep a screen reader's focus on, so it is taken to the heading first,
  // and the toast's announcement is the last thing it says.
  const stepSheet = useStepSheet(draft.steps, stepEdits, focusStepsHeading);
  // Toasts sit above the pinned Save, as the board draws them, and not above a tab bar this screen has not.
  useToastAboveBar(dockHeight);

  const isNewRecipe = existing === undefined;
  const isChanged = isRecipeDraftChanged(baseline, draft);
  const isLocked = saveStatus !== "idle";
  const isFull = draft.ingredients.length >= MAX_RECIPE_INGREDIENTS;

  const validation = validateRecipeDraft(draft);
  const sentences = problemSentences(validation.ok ? [] : validation.problems);
  const shownSentences: ProblemSentences = hasTriedToSave ? sentences : { ingredients: [] };
  const hasShownProblem =
    shownSentences.name !== undefined ||
    shownSentences.servings !== undefined ||
    shownSentences.cookedWeight !== undefined ||
    shownSentences.ingredients.length > 0;

  const card = recipeCardOf(useSettledValue(draft, CARD_FOLLOWS_TYPING_AFTER_MS));
  const openedIngredient = openStep === null ? undefined : openStep.ingredient;
  // A page over the editor: an ingredient's amount step, or the search for a new one.
  const isEditorCovered = openedIngredient !== undefined || isAddOpen;

  const backHref = existing === undefined ? recipesPath() : recipePath(existing.id);

  // The Android back button, the iOS swipe back and the header all end here when changes would be lost, and
  // a save under way is not interrupted. Saving and discarding both leave nothing changed, so the hold is
  // already lifted when the way out runs. With an amount step open, the way back closes the step.
  usePreventRemove(
    isChanged ||
      saveStatus === "saving" ||
      openedIngredient !== undefined ||
      isAddOpen ||
      stepSheet.isOpen,
    () => {
      if (stepSheet.isOpen) {
        // The way back closes the step sheet and keeps what was typed, as the dim does.
        stepSheet.dismiss();
      } else if (isAddOpen) {
        // The way back steps back: from the amount step to the results, and from the results to the editor.
        if (chosenFood === undefined) {
          closeAddIngredient();
        } else {
          setChosenFood(undefined);
        }
      } else if (openedIngredient !== undefined) {
        closeIngredient();
      } else if (!isLocked) {
        setIsDiscardOpen(true);
      }
    },
  );

  // A screen reader is taken back to the Ingredients heading once the editor is there to be focused, since
  // the row that was pressed may be gone.
  useEffect(() => {
    if (openStep === null && shouldFocusIngredientsHeading.current) {
      shouldFocusIngredientsHeading.current = false;
      focusIngredientsHeading();
    }
  }, [openStep]);

  // Once the search has closed, a screen reader is taken back to the row that opened it, as the opener gets
  // focus back. The most a recipe holds turns that row off, so focus goes to the line that says why. A
  // Close and an Add both end here, and an Add also scrolls to the ingredient it put at the end.
  useEffect(() => {
    if (isAddOpen || !shouldFocusAddRow.current) {
      return;
    }
    shouldFocusAddRow.current = false;
    const target = isFull ? ingredientLimitCaption.current : addIngredientRow.current;
    if (target !== null) {
      AccessibilityInfo.sendAccessibilityEvent(target, "focus");
    }
    if (shouldScrollToAdded.current) {
      shouldScrollToAdded.current = false;
      scrollToEndOfIngredients();
    }
  }, [isAddOpen, isFull]);

  // The way out runs after the render that lifted the hold, or the navigator would still refuse it. A new
  // `exit` each time, so a way out that led nowhere (the editor's own page) can be asked for again.
  useEffect(() => {
    if (exit === null) {
      return;
    }
    if (exit.how === "replace") {
      router.replace(exit.href);
    } else {
      router.dismissTo(exit.href);
    }
  }, [exit, router]);

  function focusIngredientsHeading() {
    if (ingredientsHeading.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(ingredientsHeading.current, "focus");
    }
  }

  function openIngredientStep(position: number) {
    if (isLocked) {
      return;
    }
    const ingredient = draft.ingredients[position];
    if (ingredient === undefined) {
      return;
    }
    // A field that still holds the keyboard would keep it up under the page, and a toast would cover the
    // page's controls and offer an Undo that changes the list behind it.
    Keyboard.dismiss();
    toast.dismiss();
    stepCount.current += 1;
    setOpenStep({ ingredient, id: stepCount.current });
  }

  function focusStepsHeading() {
    if (stepsHeading.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(stepsHeading.current, "focus");
    }
  }

  function openStepSheet(position: number) {
    if (!isLocked) {
      stepSheet.openStep(position);
    }
  }

  function openNewStepSheet() {
    if (!isLocked) {
      stepSheet.openNewStep();
    }
  }

  function openAddIngredient() {
    if (isLocked) {
      return;
    }
    // A field that still holds the keyboard would keep it up under the search, and a toast would cover the
    // search and offer an Undo that changes the list behind it.
    Keyboard.dismiss();
    toast.dismiss();
    setChosenFood(undefined);
    setIsAddOpen(true);
  }

  function closeAddIngredient() {
    shouldFocusAddRow.current = true;
    setChosenFood(undefined);
    setIsAddOpen(false);
  }

  function addIngredientToDraft(ingredient: RecipeIngredient) {
    ingredientEdits.add(ingredient);
    shouldScrollToAdded.current = true;
    closeAddIngredient();
  }

  function closeIngredient() {
    shouldFocusIngredientsHeading.current = true;
    setOpenStep(null);
  }

  // What the open step does to the list, by where its ingredient is by then. One that is no longer in the
  // list leaves nothing to change, so the step just closes.
  function changeOpenIngredient(change: (position: number) => void) {
    const position =
      openedIngredient === undefined ? -1 : draft.ingredients.indexOf(openedIngredient);
    if (position !== -1) {
      change(position);
    }
    closeIngredient();
  }

  function removeIngredientAt(position: number) {
    if (isLocked) {
      return;
    }
    // Focus goes first, so the toast's announcement is the last thing a screen reader says.
    focusIngredientsHeading();
    ingredientEdits.remove(position);
  }

  function changeField(field: RecipeDetailsField, text: string) {
    setDraft((current) => ({ ...current, [field]: text }));
  }

  // Scrolls so the target sits near the top of the list, in place of leaving it to the keyboard.
  function scrollTo(target: Pick<HostInstance, "measureLayout"> | null) {
    const scrollView = scrollViewRef.current;
    const content = contentRef.current;
    if (scrollView === null || content === null || target === null) {
      return;
    }
    target.measureLayout(
      content,
      (_left, top) => {
        scrollView.scrollTo({ y: Math.max(0, top - ROOM_ABOVE_PROBLEM), animated: false });
      },
      () => undefined,
    );
  }

  // Scrolls just far enough forward that the end of the Ingredients, where the new ingredient now sits above
  // the Add ingredient row, is in view. An end that is in view already is left where it is.
  function scrollToEndOfIngredients() {
    const scrollView = scrollViewRef.current;
    const content = contentRef.current;
    const section = ingredientsSection.current;
    if (scrollView === null || content === null || section === null) {
      return;
    }
    section.measureLayout(
      content,
      (_left, top, _width, height) => {
        const y = top + height - scrollViewportHeight.current + ROOM_BELOW_INGREDIENTS;
        if (scrollViewportHeight.current > 0 && y > scrollOffset.current) {
          scrollView.scrollTo({ y, animated: false });
        }
      },
      () => undefined,
    );
  }

  function trackScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
    trackScrollOffset(event);
  }

  function trackViewport(event: LayoutChangeEvent) {
    scrollViewportHeight.current = event.nativeEvent.layout.height;
  }

  function focusFirstProblem(found: ProblemSentences) {
    const field =
      found.name !== undefined
        ? nameField.current
        : found.servings !== undefined
          ? servingsField.current
          : found.cookedWeight !== undefined
            ? cookedWeightField.current
            : null;
    if (field !== null) {
      scrollTo(field);
      field.focus();
    } else if (found.ingredients.length > 0) {
      scrollTo(ingredientsSection.current);
      // There is no field to focus, so a screen reader is taken to the heading the sentence sits under.
      focusIngredientsHeading();
    }
  }

  async function save() {
    if (isSavingNow.current || !isOnline) {
      return;
    }
    setHasTriedToSave(true);
    setHasSaveFailed(false);

    const result = validateRecipeDraft(draft);
    if (!result.ok) {
      focusFirstProblem(problemSentences(result.problems));
      return;
    }

    isSavingNow.current = true;
    setSaveStatus("saving");
    const { name, servings, yieldGrams, steps } = result.value;
    const payload = { name, servings, yieldGrams, steps, ingredients: draft.ingredients };

    try {
      const stored =
        existing === undefined
          ? await createRecipe.mutateAsync(payload)
          : await updateRecipe.mutateAsync({ id: existing.id, ...payload });
      // The saved recipe is the new starting point, so leaving it afterwards asks nothing.
      const savedDraft = recipeDraftOf(stored);
      setBaseline(savedDraft);
      setDraft(savedDraft);
      setHasTriedToSave(false);
      // A saved recipe, new or edited, stays locked until the editor has gone, so nothing can save it twice or
      // leave it a second time. The guard on `isSavingNow` is kept too, as the exit runs a render later.
      setSaveStatus("leaving");
      toast.show({ message: RECIPE_TOASTS.saved, tone: "success", icon: "Check" });
      setExit({ href: recipePath(stored.id), how: existing === undefined ? "replace" : "dismiss" });
    } catch {
      setHasSaveFailed(true);
      setSaveStatus("idle");
      isSavingNow.current = false;
    }
  }

  // An untouched form just goes. One with changes asks first.
  function leave() {
    if (isLocked) {
      return;
    }
    if (isChanged) {
      setIsDiscardOpen(true);
    } else {
      setExit({ href: backHref, how: "dismiss" });
    }
  }

  function discard() {
    // Going to the page the editor is already on does not remount it, so the draft is put back by hand.
    setDraft(baseline);
    setHasTriedToSave(false);
    setHasSaveFailed(false);
    setIsDiscardOpen(false);
    setExit({ href: backHref, how: "dismiss" });
  }

  return (
    <View className="flex-1 bg-background">
      {/* The editor stays where it is under the amount step, so the draft, the scroll place and the fields
          are all as they were when the step closes. A screen reader cannot reach it meanwhile. */}
      <View
        aria-hidden={isEditorCovered}
        className="flex-1"
        importantForAccessibility={isEditorCovered ? "no-hide-descendants" : "auto"}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          {/* The insets and the keyboard's cover are runtime values no class can name, so they go through variables. */}
          <View
            ref={frameRef}
            className="flex-1 pb-[var(--keyboard-lift)] pt-[var(--inset-top)]"
            style={vars({ "--inset-top": insets.top, "--keyboard-lift": keyboardLift })}
          >
            <SheetHeader
              leading={{
                icon: isNewRecipe ? "X" : "ChevronLeft",
                label: isNewRecipe ? FOOD_FORM.close : FOOD_FORM.back,
                disabled: isLocked,
                onPress: leave,
              }}
              title={isNewRecipe ? RECIPE_EDITOR.newTitle : baseline.name}
            />
            {hasShownProblem || hasSaveFailed || !isOnline ? (
              <View className="gap-2 px-4 pb-3">
                {hasShownProblem ? (
                  <Banner sentence title={FOOD_FORM.validationSummary} variant="error" />
                ) : null}
                {hasSaveFailed ? (
                  <Banner sentence title={SAVE_FAILED_BANNER} variant="error" />
                ) : null}
                {isOnline ? null : (
                  <Banner
                    body={RECIPE_EDITOR.offlineEditingBody}
                    title={OFFLINE_BANNER.title}
                    variant="offline"
                  />
                )}
              </View>
            ) : null}
            <ScrollView
              ref={scrollViewRef}
              className="flex-1"
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onLayout={trackViewport}
              onScroll={trackScroll}
            >
              <View ref={contentRef} className="gap-6 px-4 pb-6 pt-1">
                <PerServingCard card={card} />
                <RecipeDetailsFields
                  cookedWeightRef={cookedWeightField}
                  draft={draft}
                  errors={shownSentences}
                  isLocked={isLocked}
                  nameRef={nameField}
                  servingsRef={servingsField}
                  onChange={changeField}
                />
                <RecipeIngredientsSection
                  ingredients={draft.ingredients}
                  problems={shownSentences.ingredients}
                  headingRef={ingredientsHeading}
                  sectionRef={ingredientsSection}
                  addRowRef={addIngredientRow}
                  isLocked={isLocked}
                  limitRef={ingredientLimitCaption}
                  onAdd={openAddIngredient}
                  onOpen={openIngredientStep}
                  onRemove={removeIngredientAt}
                />
                <RecipeStepsSection
                  headingRef={stepsHeading}
                  isLocked={isLocked}
                  steps={draft.steps}
                  onAdd={openNewStepSheet}
                  onMoveDown={stepEdits.moveDown}
                  onMoveUp={stepEdits.moveUp}
                  onOpen={openStepSheet}
                />
              </View>
            </ScrollView>
            {/* The dock is the sheet's surface under a hairline, with the board's 42 below its button. It is a
              sibling of the list, so the list ends above it and nothing scrolls under Save. */}
            <View
              className="border-t border-border bg-surface-sheet px-4 pb-[var(--dock-bottom)] pt-4"
              style={vars({ "--dock-bottom": dockBottomPadding(insets.bottom) })}
              onLayout={(event) => {
                setDockHeight(event.nativeEvent.layout.height);
              }}
            >
              <Button
                fullWidth
                disabled={!isOnline}
                haptic="confirm"
                loading={isLocked}
                size="lg"
                onPress={() => {
                  void save();
                }}
              >
                {ENTRY_SCREEN.saveAction}
              </Button>
            </View>
          </View>
          <DiscardRecipeSheet
            isNewRecipe={isNewRecipe}
            open={isDiscardOpen}
            onDiscard={discard}
            onKeepEditing={() => {
              setIsDiscardOpen(false);
            }}
          />
        </KeyboardAvoidingView>
      </View>
      {stepSheet.sheet === null ? null : (
        // Over the whole editor and not inside its keyboard avoiding view, so the sheet is lifted above the
        // keyboard once and not twice. Another opening is another sheet, so the text and the keyboard start afresh.
        <StepSheet
          key={stepSheet.sheet.id}
          isNew={stepSheet.sheet.target.kind === "add"}
          isDismissible={stepSheet.isDismissible}
          number={stepSheet.sheet.number}
          open={stepSheet.isOpen}
          text={stepSheet.sheet.text}
          onChangeText={stepSheet.changeText}
          onClose={stepSheet.dismiss}
          onDone={stepSheet.done}
          onRemove={stepSheet.remove}
        />
      )}
      {isAddOpen ? (
        <View accessibilityViewIsModal className="absolute inset-0 bg-background">
          <AddIngredientSheet
            chosen={chosenFood}
            onAdd={addIngredientToDraft}
            onBackToResults={() => {
              setChosenFood(undefined);
            }}
            onChoose={setChosenFood}
            onClose={closeAddIngredient}
          />
        </View>
      ) : null}
      {openStep === null ? null : (
        <View accessibilityViewIsModal className="absolute inset-0 bg-background">
          <IngredientAmountStep
            // Another ingredient is another page, so the amount and the unit start afresh.
            key={openStep.id}
            ingredient={openStep.ingredient}
            onBack={closeIngredient}
            onRemove={() => {
              changeOpenIngredient(ingredientEdits.remove);
            }}
            onSave={(ingredient) => {
              changeOpenIngredient((position) => {
                ingredientEdits.replace(position, ingredient);
              });
            }}
          />
        </View>
      )}
    </View>
  );
}
