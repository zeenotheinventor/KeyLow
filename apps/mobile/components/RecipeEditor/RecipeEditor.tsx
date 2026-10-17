import { useCreateRecipe, useUpdateRecipe } from "@keylow/api-client";
import {
  ENTRY_SCREEN,
  FOOD_FORM,
  OFFLINE_BANNER,
  RECIPE_EDITOR,
  RECIPE_TOASTS,
  SAVE_FAILED_BANNER,
} from "@keylow/core/copy";
import {
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
import { AccessibilityInfo, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { problemSentences } from "./problemSentences";
import { useIsOnline } from "../../lib/connectivity";
import { dockBottomPadding } from "../../lib/dockBottomPadding";
import { recipePath, recipesPath } from "../../lib/recipeRoutes";
import { useKeyboardLift } from "../../lib/useKeyboardLift";
import { useScrollFocusedInputIntoView } from "../../lib/useScrollFocusedInputIntoView";
import { useSettledValue } from "../../lib/useSettledValue";
import { DiscardRecipeSheet } from "../DiscardRecipeSheet";
import { PerServingCard } from "../PerServingCard";
import { RecipeDetailsFields } from "../RecipeDetailsFields";
import { RecipeIngredientsSection } from "../RecipeIngredientsSection";
import { Banner, Button, SheetHeader, useToast } from "../ui";

import type { ProblemSentences } from "./problemSentences";
import type { RecipeEditorProps } from "./types";
import type { RecipeDetailsField } from "../RecipeDetailsFields";
import type { RecipeDraft } from "@keylow/core/recipes";
import type { HostInstance, TextInput } from "react-native";

// How long typing has to stop before the Per serving card follows it, and so before it is read out.
const CARD_FOLLOWS_TYPING_AFTER_MS = 500;

// How far above the top of the scroll view a field is left when Save scrolls to it.
const ROOM_ABOVE_PROBLEM = 16;

type SaveStatus = "idle" | "saving" | "created";

/** Where the screen goes once nothing holds it back. A new recipe is replaced by its saved one, anything else is gone back to. */
type Exit = { href: string; how: "dismiss" | "replace" };

/**
 * The recipe editor: the details, the ingredients (read only until they can be added) and the Per serving
 * card, which follows the servings and the cooked weight once typing stops. Save is always pressable (but
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

  const frameRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const nameField = useRef<TextInput>(null);
  const servingsField = useRef<TextInput>(null);
  const cookedWeightField = useRef<TextInput>(null);
  const ingredientsSection = useRef<View>(null);
  const ingredientsHeading = useRef<View>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard. iOS has the padding view.
  const keyboardLift = useKeyboardLift(frameRef, Platform.OS === "android");
  const trackScrollOffset = useScrollFocusedInputIntoView(scrollViewRef, keyboardLift);

  const isNewRecipe = existing === undefined;
  const isChanged = isRecipeDraftChanged(baseline, draft);
  const isLocked = saveStatus !== "idle";

  const validation = validateRecipeDraft(draft);
  const sentences = problemSentences(validation.ok ? [] : validation.problems);
  const shownSentences: ProblemSentences = hasTriedToSave ? sentences : { ingredients: [] };
  const hasShownProblem =
    shownSentences.name !== undefined ||
    shownSentences.servings !== undefined ||
    shownSentences.cookedWeight !== undefined ||
    shownSentences.ingredients.length > 0;

  const card = recipeCardOf(useSettledValue(draft, CARD_FOLLOWS_TYPING_AFTER_MS));

  const backHref = existing === undefined ? recipesPath() : recipePath(existing.id);

  // The Android back button, the iOS swipe back and the header all end here when changes would be lost, and
  // a save under way is not interrupted. Saving and discarding both leave nothing changed, so the hold is
  // already lifted when the way out runs.
  usePreventRemove(isChanged || saveStatus === "saving", () => {
    if (!isLocked) {
      setIsDiscardOpen(true);
    }
  });

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
      if (ingredientsHeading.current !== null) {
        AccessibilityInfo.sendAccessibilityEvent(ingredientsHeading.current, "focus");
      }
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
      // A new recipe stays locked while it is replaced by its saved one, so nothing can save it twice.
      setSaveStatus(existing === undefined ? "created" : "idle");
      toast.show({ message: RECIPE_TOASTS.saved, tone: "success", icon: "Check" });
      setExit({ href: recipePath(stored.id), how: existing === undefined ? "replace" : "dismiss" });
    } catch {
      setHasSaveFailed(true);
      setSaveStatus("idle");
    } finally {
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
            onScroll={trackScrollOffset}
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
              />
            </View>
          </ScrollView>
          {/* The dock is the sheet's surface under a hairline, with the board's 42 below its button. It is a
              sibling of the list, so the list ends above it and nothing scrolls under Save. */}
          <View
            className="border-t border-border bg-surface-sheet px-4 pb-[var(--dock-bottom)] pt-4"
            style={vars({ "--dock-bottom": dockBottomPadding(insets.bottom) })}
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
  );
}
