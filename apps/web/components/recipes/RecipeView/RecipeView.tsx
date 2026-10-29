"use client";

import { useRecipes } from "@keylow/api-client";
import { OFFLINE_BANNER, RECIPE_VIEW, RECIPES_LIBRARY } from "@keylow/core/copy";
import {
  enteredViewServings,
  recipeCardOf,
  recipeDraftOf,
  recipeViewOf,
  stepViewServings,
} from "@keylow/core/recipes";
import { WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PerServingCard } from "../PerServingCard";
import { RecipeEditorFrame } from "../RecipeEditorFrame";
import { RecipeEditorLayout } from "../RecipeEditorLayout";
import { RecipeRefreshDialog } from "../RecipeRefreshDialog";
import { RecipeViewActions } from "../RecipeViewActions";
import { RecipeViewIngredientsCard } from "../RecipeViewIngredientsCard";
import { RecipeViewStepsCard } from "../RecipeViewStepsCard";
import { ServingsCard } from "../ServingsCard";

import type { RecipeViewProps } from "./types";
import type { ServingsStepDirection } from "@/components/ui/ServingsStepper";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Banner } from "@/components/ui/Banner";
import { useRecipeActions } from "@/lib/recipeActions";
import { editRecipePath, recipePath, recipesPath } from "@/lib/recipeRoutes";
import { useIsOnline } from "@/lib/useIsOnline";

// How long typing has to stop before the new amounts are read out.
const ANNOUNCE_AFTER_TYPING_MS = 500;

/**
 * The recipe view, the page you cook from: what one serving gives, the servings you are making, the
 * ingredients in the amounts that number needs, then the method. The servings are this page's own and
 * start at the recipe's every time it opens; changing them changes what is on screen and nothing else,
 * so nothing is saved or sent. It holds no arithmetic, rounding or checks: what the amounts say, what
 * counts as a servings number and what a button does to it are core's. Its Duplicate and Archive buttons
 * are the library's own actions (`useRecipeActions`): a copy opens on its own page, and an archived recipe
 * leaves for the library, each with a toast that has Undo. Refresh ingredients opens a dialog over the page.
 */
export function RecipeView({ recipe }: RecipeViewProps) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const actions = useRecipeActions();
  // A copy is named from the names in the library, archived ones included, so it is read here too.
  const library = useRecipes({ archived: true });
  // Null is the recipe's own servings, so the number is never one the recipe has since stopped having.
  const [chosenServings, setChosenServings] = useState<number | null>(null);
  const [text, setText] = useState(() => String(recipe.servings));
  const [hasProblem, setHasProblem] = useState(false);
  const [isRefreshOpen, setIsRefreshOpen] = useState(false);
  // Whether the new amounts are due to be read out. What is read is always the view's own words.
  const [isAnnouncementDue, setIsAnnouncementDue] = useState(false);
  const servingsField = useRef<HTMLInputElement>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const view = recipeViewOf(recipe, chosenServings);
  // The card is for the recipe as saved, so it never follows the servings.
  const card = recipeCardOf(recipeDraftOf(recipe));
  const announcement = isAnnouncementDue ? view.announcement : "";

  useEffect(
    () => () => {
      clearTimeout(announceTimer.current);
    },
    [],
  );

  function announce(after: number) {
    clearTimeout(announceTimer.current);
    if (after === 0) {
      setIsAnnouncementDue(true);
    } else {
      // The words that were read out before are cleared, so what is read next is read as new.
      setIsAnnouncementDue(false);
      announceTimer.current = setTimeout(() => {
        setIsAnnouncementDue(true);
      }, after);
    }
  }

  // The recipe's own servings are kept as null however they were arrived at, so a recipe saved at 2.5 and
  // typed back as "2.5" is the recipe's own and not a chosen number to keep.
  function choose(servings: number) {
    setChosenServings(servings === recipe.servings ? null : servings);
  }

  function setServings(servings: number) {
    choose(servings);
    setText(String(servings));
    setHasProblem(false);
    announce(0);
  }

  function handleStep(direction: ServingsStepDirection) {
    const next = stepViewServings(view.servings, direction === 1 ? "plus" : "minus");
    if (next !== null) {
      setServings(next);
    }
  }

  function handleChangeText(typed: string) {
    setText(typed);
    const entered = enteredViewServings(typed, recipe.servings);
    setHasProblem(entered === null);
    if (entered !== null) {
      choose(entered);
      announce(ANNOUNCE_AFTER_TYPING_MS);
    }
  }

  function handleBlur() {
    setText(String(view.servings));
    setHasProblem(false);
  }

  function handleReset() {
    setServings(recipe.servings);
    // The link goes with the reset, so focus is put where the person is working.
    servingsField.current?.focus();
  }

  // The copy opens on its own page, and Undo puts the copy away and goes back to this one. Where the user is
  // when Undo is pressed is read from the address, since this page may be gone by then. If they have left
  // the copy's page, there is no page of the copy's to leave.
  function duplicate() {
    actions.duplicate(recipe, {
      onSaved: (copy) => {
        router.push(recipePath(copy.id));
      },
      onUndone: (copy) => {
        if (window.location.pathname === recipePath(copy.id)) {
          router.replace(recipePath(recipe.id));
        }
      },
    });
  }

  function archive() {
    actions.archive(recipe, {
      onArchived: () => {
        router.push(recipesPath());
      },
    });
  }

  return (
    <RecipeEditorFrame
      backLink={
        <BackToFoodsLink tone="accent" label={RECIPES_LIBRARY.title} href={recipesPath()} />
      }
      title={recipe.name}
      titleAction={
        <RecipeViewActions
          name={recipe.name}
          editHref={editRecipePath(recipe.id)}
          isOnline={isOnline}
          isArchived={recipe.is_archived}
          isLibraryRead={!library.isPending}
          isDuplicating={actions.isDuplicating(recipe.id)}
          isArchiving={actions.isArchiving(recipe.id)}
          onRefresh={() => {
            setIsRefreshOpen(true);
          }}
          onDuplicate={duplicate}
          onArchive={archive}
        />
      }
    >
      <RecipeEditorLayout
        notices={
          isOnline ? undefined : (
            <Banner title={OFFLINE_BANNER.title} icon={WifiOff}>
              {RECIPE_VIEW.offlineBody}
            </Banner>
          )
        }
        summary={
          <div className="flex flex-col gap-5 lg:gap-3">
            <PerServingCard card={card} />
            <ServingsCard
              text={text}
              onChangeText={handleChangeText}
              value={view.servings}
              valueText={view.valueText}
              canDecrease={stepViewServings(view.servings, "minus") !== null}
              canIncrease={stepViewServings(view.servings, "plus") !== null}
              onStep={handleStep}
              error={hasProblem ? RECIPE_VIEW.servingsProblem : undefined}
              onBlur={handleBlur}
              fieldRef={servingsField}
              yieldLine={view.yieldLine}
              resetLabel={view.resetLabel}
              onReset={handleReset}
            />
          </div>
        }
      >
        <RecipeViewIngredientsCard
          ingredients={view.ingredients}
          servingsLine={view.ingredientsFor}
        />
        {recipe.instructions.length > 0 && (
          <RecipeViewStepsCard steps={recipe.instructions} servingsNote={view.stepsNote} />
        )}
      </RecipeEditorLayout>
      {/* The new amounts are read out once, not as a stream: each row is read when it is reached. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {/* Over the view, which stays as it is, so the servings chosen here are untouched by a refresh. */}
      <RecipeRefreshDialog
        open={isRefreshOpen}
        recipeId={recipe.id}
        onClose={() => {
          setIsRefreshOpen(false);
        }}
      />
    </RecipeEditorFrame>
  );
}
