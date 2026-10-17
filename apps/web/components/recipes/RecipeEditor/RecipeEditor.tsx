"use client";

import { useCreateRecipe, useUpdateRecipe } from "@keylow/api-client";
import {
  ENTRY_SCREEN,
  EDIT_ENTRY_DIALOG,
  FOOD_FORM,
  OFFLINE_BANNER,
  RECIPE_EDITOR,
  RECIPE_TOASTS,
  SAVE_FAILED_BANNER,
  TAB_TITLES,
} from "@keylow/core/copy";
import {
  isRecipeDraftChanged,
  newRecipeDraft,
  recipeCardOf,
  recipeDraftOf,
  validateRecipeDraft,
} from "@keylow/core/recipes";
import { Check, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { problemSentences } from "./problemSentences";
import { DiscardRecipeDialog } from "../DiscardRecipeDialog";
import { PerServingCard } from "../PerServingCard";
import { RecipeDetailsCard } from "../RecipeDetailsCard";
import { RecipeEditorFrame } from "../RecipeEditorFrame";
import { RecipeEditorLayout } from "../RecipeEditorLayout";
import { RecipeIngredientsCard } from "../RecipeIngredientsCard";

import type { ProblemSentences } from "./problemSentences";
import type { RecipeEditorProps } from "./types";
import type { RecipeDetailsField } from "../RecipeDetailsCard";
import type { RecipeDraft } from "@keylow/core/recipes";
import type { MouseEvent, SubmitEvent } from "react";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { recipePath, recipesPath } from "@/lib/recipeRoutes";
import { useIsOnline } from "@/lib/useIsOnline";
import { useSettledValue } from "@/lib/useSettledValue";
import { cn } from "@/lib/utils";

// How long typing has to stop before the Per serving card follows it, and so before it is read out.
const CARD_FOLLOWS_TYPING_AFTER_MS = 500;

type SaveStatus = "idle" | "saving" | "created";

/**
 * The recipe editor: the details, the ingredients (read only until they can be added) and the Per serving
 * card, which follows the servings and the cooked weight once typing stops. Save is always pressable, and a
 * failed one says what to fix, field by field, and moves focus to the first. Leaving with changes asks
 * first. It holds no sums of its own: the card, the checks, the sentences and what counts as a change are
 * core's.
 */
export function RecipeEditor({ existing, initialName }: RecipeEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const isOnline = useIsOnline();
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();

  const [baseline, setBaseline] = useState<RecipeDraft>(() =>
    existing === undefined ? newRecipeDraft(initialName) : recipeDraftOf(existing),
  );
  const [draft, setDraft] = useState<RecipeDraft>(baseline);
  const [hasTriedToSave, setHasTriedToSave] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasSaveFailed, setHasSaveFailed] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const isSavingNow = useRef(false);

  const nameField = useRef<HTMLInputElement>(null);
  const servingsField = useRef<HTMLInputElement>(null);
  const cookedWeightField = useRef<HTMLInputElement>(null);
  const ingredientsCard = useRef<HTMLElement>(null);

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

  // The browser's own prompt covers closing the tab. A move inside the app is asked by the dialog.
  useEffect(() => {
    if (!isChanged) {
      return;
    }
    const askBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", askBeforeLeaving);

    return () => {
      window.removeEventListener("beforeunload", askBeforeLeaving);
    };
  }, [isChanged]);

  function changeField(field: RecipeDetailsField, text: string) {
    setDraft((current) => ({ ...current, [field]: text }));
  }

  function focusFirstProblem(found: ProblemSentences) {
    if (found.name !== undefined) {
      nameField.current?.focus();
    } else if (found.servings !== undefined) {
      servingsField.current?.focus();
    } else if (found.cookedWeight !== undefined) {
      cookedWeightField.current?.focus();
    } else if (found.ingredients.length > 0) {
      ingredientsCard.current?.focus();
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
      setSaveStatus(existing === undefined ? "created" : "idle");
      toast.show({ message: RECIPE_TOASTS.saved, tone: "success", icon: Check });
      router.replace(recipePath(stored.id));
    } catch {
      setHasSaveFailed(true);
      setSaveStatus("idle");
    } finally {
      isSavingNow.current = false;
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }

  // A move that would lose changes is stopped and asked about. An untouched form just goes.
  function handleBackClick(event: MouseEvent<HTMLAnchorElement>) {
    if (isLocked) {
      event.preventDefault();
    } else if (isChanged) {
      event.preventDefault();
      setLeaveTo(backHref);
    }
  }

  function handleCancel() {
    if (isLocked) {
      return;
    }
    if (isChanged) {
      setLeaveTo(backHref);
    } else {
      router.push(backHref);
    }
  }

  const notices = (hasShownProblem || hasSaveFailed || !isOnline) && (
    <>
      {hasShownProblem && <Banner tone="error">{FOOD_FORM.validationSummary}</Banner>}
      {hasSaveFailed && <Banner tone="error">{SAVE_FAILED_BANNER}</Banner>}
      {!isOnline && (
        <Banner title={OFFLINE_BANNER.title} icon={WifiOff}>
          {RECIPE_EDITOR.offlineEditingBody}
        </Banner>
      )}
    </>
  );

  return (
    <RecipeEditorFrame
      backLink={
        <BackToFoodsLink
          tone="accent"
          label={existing === undefined ? TAB_TITLES.recipes : baseline.name}
          href={backHref}
          onClick={handleBackClick}
        />
      }
      title={existing === undefined ? RECIPE_EDITOR.newTitle : baseline.name}
    >
      <form noValidate onSubmit={handleSubmit}>
        <RecipeEditorLayout
          notices={notices === false ? undefined : notices}
          summary={<PerServingCard card={card} />}
          actions={
            <>
              <Button
                type="submit"
                className={cn("w-full max-lg:h-control-lg", !isOnline && "opacity-40")}
                loading={saveStatus !== "idle"}
                loadingLabel={FOOD_FORM.saving}
                // An offline Save stays in the tab order, dimmed and not disabled, and the banner says why.
                aria-disabled={!isOnline || undefined}
              >
                {ENTRY_SCREEN.saveAction}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full max-lg:hidden"
                onClick={handleCancel}
              >
                {EDIT_ENTRY_DIALOG.cancel}
              </Button>
            </>
          }
        >
          <RecipeDetailsCard
            draft={draft}
            errors={shownSentences}
            isLocked={isLocked}
            onChange={changeField}
            nameRef={nameField}
            servingsRef={servingsField}
            cookedWeightRef={cookedWeightField}
          />
          <RecipeIngredientsCard
            ingredients={draft.ingredients}
            problems={shownSentences.ingredients}
            focusRef={ingredientsCard}
          />
        </RecipeEditorLayout>
      </form>
      <DiscardRecipeDialog
        open={leaveTo !== null}
        isNewRecipe={isNewRecipe}
        onKeepEditing={() => {
          setLeaveTo(null);
        }}
        onDiscard={() => {
          // Going to the page the editor is already on does not remount it, so the draft is put back by hand.
          setDraft(baseline);
          setHasTriedToSave(false);
          setHasSaveFailed(false);
          setLeaveTo(null);
          if (leaveTo !== null) {
            router.push(leaveTo);
          }
        }}
      />
    </RecipeEditorFrame>
  );
}
