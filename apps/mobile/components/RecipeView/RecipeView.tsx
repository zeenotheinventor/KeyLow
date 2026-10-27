import {
  DIARY_MORE_LABEL,
  FOOD_FORM,
  OFFLINE_BANNER,
  RECIPE_VIEW,
  describeEditRecipe,
} from "@keylow/core/copy";
import {
  enteredViewServings,
  recipeCardOf,
  recipeDraftOf,
  recipeViewOf,
  stepViewServings,
} from "@keylow/core/recipes";
import { usePathname, useRouter } from "expo-router";
import { vars } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useIsOnline } from "../../lib/connectivity";
import { editRecipePath, recipePath, recipesPath, refreshRecipePath } from "../../lib/recipeRoutes";
import { PerServingCard } from "../PerServingCard";
import { useRecipeActions } from "../RecipeActions";
import { RecipeViewIngredientsSection } from "../RecipeViewIngredientsSection";
import { RecipeViewMenu } from "../RecipeViewMenu";
import { RecipeViewStepsSection } from "../RecipeViewStepsSection";
import { ServingsCard } from "../ServingsCard";
import { Banner, SheetHeader } from "../ui";

import type { RecipeViewProps } from "./types";
import type { TextInput } from "react-native";

// The space under the last section, and the least room under it for the system bar, from the board.
const CONTENT_BOTTOM_GAP = 24;
const MINIMUM_BOTTOM_PADDING = 34;

// How long typing has to stop before the new amounts are read out.
const ANNOUNCE_AFTER_TYPING_MS = 500;

/**
 * The recipe view, the screen you cook from: what one serving gives, the servings you are making, the
 * ingredients in the amounts that number needs, then the method. The servings are this screen's own and
 * start at the recipe's every time it opens; changing them changes what is on screen and nothing else, so
 * nothing is saved or sent. It holds no arithmetic, rounding or checks: what the amounts say, what counts
 * as a servings number and what a button does to it are core's. Its More menu duplicates or archives the
 * recipe through `useRecipeActions`, the library's own actions: a copy opens on its own view, and an
 * archived recipe leaves for the library, each with a toast that has Undo. Its Refresh ingredients opens the
 * refresh screen over it, and the servings chosen here stay while that screen is open and after it.
 */
export function RecipeView({ recipe, onBack }: RecipeViewProps) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();
  const recipeActions = useRecipeActions();
  const pathname = usePathname();
  // Null is the recipe's own servings, so the number is never one the recipe has since stopped having.
  const [chosenServings, setChosenServings] = useState<number | null>(null);
  // What is in the field while it is being typed in, or null when it shows the servings in use.
  const [typedText, setTypedText] = useState<string | null>(null);
  const servingsField = useRef<TextInput>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestAnnouncement = useRef("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // A menu left open when the phone goes offline closes, so nothing chosen then waits for the connection.
  const [wasOnline, setWasOnline] = useState(isOnline);
  if (isOnline !== wasOnline) {
    setWasOnline(isOnline);
    if (!isOnline) {
      setIsMenuOpen(false);
    }
  }
  // A double tap on an item must act once, and the sheet is still on screen for the second tap.
  const hasChosenFromMenu = useRef(false);
  // Where the user is when Undo is pressed, which is after the toast's closure was made.
  const latestPathname = useRef(pathname);

  const view = recipeViewOf(recipe, chosenServings);
  // The card is for the recipe as saved, so it never follows the servings.
  const card = recipeCardOf(recipeDraftOf(recipe));
  const hasProblem = typedText !== null && enteredViewServings(typedText, recipe.servings) === null;

  useEffect(() => {
    latestAnnouncement.current = view.announcement;
    latestPathname.current = pathname;
  });

  useEffect(
    () => () => {
      clearTimeout(announceTimer.current);
    },
    [],
  );

  // The recipe's own servings are kept as null however they were arrived at, so a recipe saved at 2.5 and
  // typed back as "2.5" is the recipe's own and not a chosen number to keep.
  function choose(servings: number) {
    setChosenServings(servings === recipe.servings ? null : servings);
  }

  // Told once, politely, right after a press: the words are those of the number just chosen, which is
  // always a whole number or the recipe's own.
  function announceNow(servings: number) {
    clearTimeout(announceTimer.current);
    AccessibilityInfo.announceForAccessibility(recipeViewOf(recipe, servings).announcement);
  }

  // Told once typing has stopped: the words are the view's own when the time comes, so what is said is
  // what is on the screen even if the recipe was read again meanwhile.
  function announceWhenTypingStops() {
    clearTimeout(announceTimer.current);
    announceTimer.current = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(latestAnnouncement.current);
    }, ANNOUNCE_AFTER_TYPING_MS);
  }

  function handleStep(direction: 1 | -1) {
    const next = stepViewServings(view.servings, direction === 1 ? "plus" : "minus");
    if (next !== null) {
      choose(next);
      setTypedText(null);
      announceNow(next);
    }
  }

  function handleChangeText(typed: string) {
    setTypedText(typed);
    const entered = enteredViewServings(typed, recipe.servings);
    if (entered === null) {
      // Nothing is told for a problem, and nothing from the number before it either.
      clearTimeout(announceTimer.current);
    } else {
      choose(entered);
      announceWhenTypingStops();
    }
  }

  function handleBlur() {
    setTypedText(null);
  }

  function handleReset() {
    setChosenServings(null);
    setTypedText(null);
    announceNow(recipe.servings);
    // The link goes with the reset, so focus is put where the person is working.
    servingsField.current?.focus();
  }

  function handleEdit() {
    // Coming back from the editor, after a Save that may have changed the servings, starts at the recipe's own.
    clearTimeout(announceTimer.current);
    setChosenServings(null);
    setTypedText(null);
    router.push(editRecipePath(recipe.id));
  }

  function openMenu() {
    hasChosenFromMenu.current = false;
    setIsMenuOpen(true);
  }

  // Choosing an item closes the sheet and acts at once, once.
  function chooseFromMenu(act: () => void) {
    setIsMenuOpen(false);
    if (!hasChosenFromMenu.current) {
      hasChosenFromMenu.current = true;
      act();
    }
  }

  // The refresh screen opens over this view, which stays as it is beneath it, servings chosen included.
  function refresh() {
    router.push(refreshRecipePath(recipe.id));
  }

  // The copy opens on its own view over this one. Undo puts the copy away and goes back to this view, unless
  // the user has already left the copy's view, in which case there is no copy's view to leave.
  function duplicate() {
    recipeActions.duplicate(recipe, {
      onSaved: (copy) => {
        router.push(recipePath(copy.id));
      },
      onUndone: (copy) => {
        if (latestPathname.current === recipePath(copy.id)) {
          router.back();
        }
      },
    });
  }

  function archive() {
    recipeActions.archive(recipe, {
      onArchived: () => {
        router.dismissTo(recipesPath());
      },
    });
  }

  return (
    // The insets are runtime values no class can name, so they go through variables. The list ends 24
    // points under its last row and then clears the system bar, which is at least the board's 34.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({
        "--inset-top": insets.top,
        "--content-bottom": CONTENT_BOTTOM_GAP + Math.max(insets.bottom, MINIMUM_BOTTOM_PADDING),
      })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: FOOD_FORM.back, onPress: onBack }}
        title={recipe.name}
        // Offline, Edit and More stay focusable and say they are disabled, and the banner says why.
        trailing={[
          {
            icon: "Pencil",
            label: describeEditRecipe(recipe.name),
            disabled: !isOnline,
            onPress: handleEdit,
          },
          {
            icon: "Ellipsis",
            label: DIARY_MORE_LABEL,
            disabled: !isOnline,
            onPress: openMenu,
          },
        ]}
      />
      {isOnline ? null : (
        <View className="px-4 pb-3">
          <Banner body={RECIPE_VIEW.offlineBody} title={OFFLINE_BANNER.title} variant="offline" />
        </View>
      )}
      {/* The number pad has no Return or Done key on iOS, so a drag on the list puts it away. */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pb-[var(--content-bottom)] pt-1"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <PerServingCard card={card} />
        <ServingsCard
          canDecrease={stepViewServings(view.servings, "minus") !== null}
          canIncrease={stepViewServings(view.servings, "plus") !== null}
          error={hasProblem ? RECIPE_VIEW.servingsProblem : undefined}
          fieldRef={servingsField}
          resetLabel={view.resetLabel}
          text={typedText ?? String(view.servings)}
          valueText={view.valueText}
          yieldLine={view.yieldLine}
          onBlur={handleBlur}
          onChangeText={handleChangeText}
          onReset={handleReset}
          onStep={handleStep}
        />
        <RecipeViewIngredientsSection
          ingredients={view.ingredients}
          servingsLine={view.ingredientsFor}
        />
        {recipe.instructions.length > 0 ? (
          <RecipeViewStepsSection servingsNote={view.stepsNote} steps={recipe.instructions} />
        ) : null}
      </ScrollView>
      <RecipeViewMenu
        isArchived={recipe.is_archived}
        open={isMenuOpen}
        onArchive={() => {
          chooseFromMenu(archive);
        }}
        onClose={() => {
          setIsMenuOpen(false);
        }}
        onRefresh={() => {
          chooseFromMenu(refresh);
        }}
        onDuplicate={() => {
          chooseFromMenu(duplicate);
        }}
      />
    </View>
  );
}
