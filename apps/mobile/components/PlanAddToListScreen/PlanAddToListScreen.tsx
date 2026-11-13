import { useAddPlanToList, usePlanShoppingPreview } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  MEAL_PLAN_WORDS,
  PLAN_SHOPPING_WORDS,
  RETRY_LABEL,
  SHOPPING_LIST,
  describePlanDaySubtitle,
} from "@keylow/core/copy";
import { isCalendarDay } from "@keylow/core/dates";
import { planShoppingOf } from "@keylow/core/plans";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { planPath } from "../../lib/planRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { AddToListLayout, DraftGroups } from "../AddToListScreen";
import { usePlanData } from "../PlanScreen";
import { ErrorState, Skeleton, Text, useToast } from "../ui";

import type { PlanAddToListScreenProps } from "./types";

/**
 * `/plan/add-to-list`, pushed over the Plan screen or a day of it (`plan · shopping-added`): adds the foods of the
 * days from `start` to `end` that are not confirmed to the shopping list. It is the add screen of a recipe for a
 * plan: the days named under the title, a line saying what is counted, the foods to buy with the recipes their
 * amounts came from, and the store cupboard staples left out, each with a box that adds it anyway. What is a staple
 * and how the amounts add up are core's. Add writes once, all or nothing, says so in a toast and goes back. A
 * failure says so in a toast and stays. Adding the same days again adds the amounts again, as adding a recipe does.
 */
export function PlanAddToListScreen({ start, end }: PlanAddToListScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const isReadEnabled = useReadsEnabled();
  const { planRows, isError, refetch } = usePlanData();
  const add = useAddPlanToList();
  // The staples the person chose to add anyway, by food. Nothing is kept once the screen goes.
  const [addAnyway, setAddAnyway] = useState<readonly string[]>([]);
  const hasDays =
    start !== undefined && end !== undefined && isCalendarDay(start) && isCalendarDay(end);
  const shopping = useMemo(
    () => (planRows === undefined || !hasDays ? null : planShoppingOf(planRows, { start, end })),
    [planRows, hasDays, start, end],
  );
  const state = usePlanShoppingPreview(shopping, { enabled: isReadEnabled });

  function leave() {
    // A cold link to this screen has nothing before it, so the person goes to the Plan screen.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(planPath());
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

  // Set at once when Add is pressed, since two presses can come before the next render shows the write pending.
  const isWriting = useRef(false);

  function submit() {
    if (isWriting.current || shopping === null || isNothingToAdd) {
      return;
    }
    isWriting.current = true;
    add.mutate(
      { shopping, addAnyway: chosenStaples.map(({ foodId }) => foodId) },
      {
        onSuccess: () => {
          toast.show({ message: SHOPPING_LIST.added, icon: "Check", tone: "success" });
          leave();
        },
        onSettled: () => {
          isWriting.current = false;
        },
        onError: () => {
          toast.show({ message: SHOPPING_LIST.addFailed, icon: "CircleAlert", tone: "danger" });
        },
      },
    );
  }

  function renderBody() {
    if (!hasDays) {
      return (
        <ErrorState
          action={{ label: MEAL_PLAN_WORDS.back, onPress: leave }}
          title={MEAL_PLAN_WORDS.dayNotFoundTitle}
        />
      );
    }
    if (isError) {
      return (
        <ErrorState
          body={MEAL_PLAN_WORDS.loadFailedBody}
          retry={{ label: RETRY_LABEL, onPress: refetch }}
          title={MEAL_PLAN_WORDS.loadFailedTitle}
        />
      );
    }
    if (planRows === undefined || (shopping !== null && state.status === "loading")) {
      return (
        <View accessible aria-label={SHOPPING_LIST.loadingLabel} role="status">
          <Skeleton rows={3} variant="group" />
        </View>
      );
    }
    if (state.status === "error") {
      return (
        <ErrorState retry={{ label: RETRY_LABEL, onPress: state.retry }} title={GENERIC_ERROR} />
      );
    }
    if (preview === null) {
      return <Text tone="secondary">{PLAN_SHOPPING_WORDS.nothingToBuy}</Text>;
    }
    return (
      <>
        <Text tone="secondary">{PLAN_SHOPPING_WORDS.scopeLine}</Text>
        <DraftGroups
          addAnyway={addAnyway}
          preview={preview}
          showsSources
          onToggleStaple={toggleStaple}
        />
      </>
    );
  }

  return (
    <AddToListLayout
      canAdd={!isNothingToAdd}
      isAdding={add.isPending}
      subtitle={
        hasDays
          ? describePlanDaySubtitle(shopping?.firstDate ?? start, shopping?.lastDate ?? end)
          : undefined
      }
      onAdd={submit}
      onLeave={leave}
    >
      {renderBody()}
    </AddToListLayout>
  );
}
