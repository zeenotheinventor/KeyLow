import {
  useFoodWithPortions,
  useLogFood,
  useProfileTimeZone,
  useRecentFoods,
  useRefreshOutdatedOffFood,
} from "@keylow/api-client";
import {
  ADDED_TOAST,
  describeLastLogged,
  describeLoggedAmount,
  describeScannedCode,
} from "@keylow/core/copy";
import { describeDay } from "@keylow/core/dates";
import { clockTimeOn, openingLoggedAt } from "@keylow/core/diary";
import { isFoodId } from "@keylow/core/foods";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { FoodLoadState } from "../../../components/FoodLoadState";
import { PortionPicker } from "../../../components/PortionPicker";
import { useToast } from "../../../components/ui";
import { amountForPicker, amountLastLogged } from "../../../lib/amountLastLogged";
import { useIsOnline } from "../../../lib/connectivity";
import { readLogContext, useCloseFoodsSheet, useGoBackInFoodsSheet } from "../../../lib/navigation";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";

import type { PortionSelection } from "../../../components/PortionPicker";

/**
 * The portion picker: a food's page for changing the serving before it is logged. It reads `day` and `time`
 * as the food sheet carries them, so the Time row shows the hour an hour's plus was pressed on ("12:00") or
 * "Now" with the current time, `barcode` when a scan opened it, and `recent` when a Recent row did, which starts
 * the amount at the one last logged. Add logs the food at the time the row
 * shows, closes the sheet to the diary and shows the toast.
 */
export default function PortionPickerRoute() {
  const router = useRouter();
  const goBack = useGoBackInFoodsSheet();
  const closeSheet = useCloseFoodsSheet();
  const toast = useToast();
  const logFood = useLogFood();
  const isOnline = useIsOnline();
  const { id, barcode, day, time, recent } = useLocalSearchParams<{
    id: string;
    barcode?: string;
    recent?: string;
    day?: string;
    time?: string;
  }>();
  const isValidId = isFoodId(id);
  const state = useFoodWithPortions(isValidId ? id : "");
  // A branded food stored before the current portion rules gets its new portions in the background.
  useRefreshOutdatedOffFood(state.status === "ready" ? state.food : undefined);
  // The diary reads its days and hours in the profile's zone, so the time logged here is read in it too.
  const isReadEnabled = useReadsEnabled();
  const profileTimeZone = useProfileTimeZone({ enabled: isReadEnabled });
  // The Recent list is the cache the sheet has just drawn it from, so this is not a new request.
  const isFromRecent = recent !== undefined;
  const recentFoods = useRecentFoods({ enabled: isReadEnabled && isFromRecent });
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  // The moment the screen opened, so "Now" does not move while the picker is open.
  const [openedAt] = useState(() => new Date());
  const logContext = readLogContext({ day, time });

  if (!isValidId) {
    return <FoodLoadState state="notFound" />;
  }

  if (state.status !== "ready") {
    return <FoodLoadState state={state.status} />;
  }

  if (profileTimeZone.isError) {
    return <FoodLoadState state="error" />;
  }

  if (profileTimeZone.data === undefined || (isFromRecent && recentFoods.isPending)) {
    return <FoodLoadState state="loading" />;
  }

  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  const timeZone = profileTimeZone.data ?? "UTC";
  const initial = openingLoggedAt(openedAt, logContext, timeZone);

  const { food, portions } = state;
  const lastLogged = isFromRecent
    ? recentFoods.data?.find((entry) => entry.foodId === food.id)
    : undefined;
  const lastAmount = lastLogged === undefined ? undefined : amountLastLogged(lastLogged, portions);
  const lastLoggedDay =
    lastLogged === undefined
      ? undefined
      : describeDay(new Date(lastLogged.loggedAt), openedAt, timeZone);

  async function handleSubmit(selection: PortionSelection) {
    setIsSaving(true);
    setHasSaveError(false);
    try {
      const { loggedAt, localDate } = selection.isNow
        ? initial
        : clockTimeOn(initial.localDate, selection.time, timeZone);
      await logFood.mutateAsync({
        food,
        quantity: selection.quantity,
        unit: selection.unit,
        ...(selection.unit === "portion" ? { portion: selection.portion } : {}),
        foodPortions: portions,
        loggedAt: loggedAt.toISOString(),
        localDate,
      });
      toast.show({ message: ADDED_TOAST, tone: "success", icon: "Check" });
      closeSheet();
    } catch {
      // The failure is not kept: it can quote the amount, which is health data. The banner says what to do.
      setHasSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PortionPicker
      food={food}
      hasSaveError={hasSaveError}
      isNow={logContext?.time === undefined}
      isOnline={isOnline}
      mode="add"
      isSaving={isSaving}
      initialAmount={lastAmount === undefined ? undefined : amountForPicker(lastAmount)}
      note={
        lastLogged === undefined || lastLoggedDay === undefined
          ? barcode === undefined
            ? undefined
            : describeScannedCode(barcode)
          : describeLastLogged(
              describeLoggedAmount(lastLogged.snapshot),
              -lastLoggedDay.daysFromToday,
              lastLoggedDay.label,
            )
      }
      portions={portions}
      time={initial.clockTime}
      onBack={goBack}
      onCopy={() => {
        router.push(`/foods/new?from=${id}`);
      }}
      onSubmit={(selection) => {
        void handleSubmit(selection);
      }}
    />
  );
}
