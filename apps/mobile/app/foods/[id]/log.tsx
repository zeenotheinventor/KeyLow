import {
  useFoodWithPortions,
  useLogFood,
  useProfileTimeZone,
  useRecentFoods,
  useRefreshOutdatedOffFood,
} from "@keylow/api-client";
import {
  ADDED_TOAST,
  describeAddedToPlate,
  describeLastLogged,
  describeLoggedAmount,
  describeScannedCode,
} from "@keylow/core/copy";
import { describeDay } from "@keylow/core/dates";
import {
  clockTimeOn,
  openingLoggedAt,
  pickerChoices,
  usualQuantityOfUnit,
} from "@keylow/core/diary";
import { isFoodId } from "@keylow/core/foods";
import { isPlateItemValid, plateFoodAmount, plateItemOfPickedFood } from "@keylow/core/plate";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { FoodLoadState } from "../../../components/FoodLoadState";
import { PortionPicker } from "../../../components/PortionPicker";
import { useToast } from "../../../components/ui";
import { amountForPicker, amountLastLogged } from "../../../lib/amountLastLogged";
import { useIsOnline } from "../../../lib/connectivity";
import {
  readLogContext,
  useCloseFoodsSheet,
  useGoBackInFoodsSheet,
  withLogContext,
} from "../../../lib/navigation";
import { usePlate } from "../../../lib/plate";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";

import type { PortionSelection } from "../../../components/PortionPicker";
import type { ChosenAmount } from "@keylow/core/diary";

/**
 * The portion picker: a food's page for changing the serving before it is put on the plate. It reads `day`
 * and `time` as the food sheet carries them, `barcode` when a scan opened it, and `recent` when a Recent row
 * did, which starts the amount at the one last logged. While food is being logged (the sheet carries a day)
 * Add to plate puts the amount on the plate, writes nothing and goes back to the search, which clears its
 * field. The plate has the time, so the page has no Time row.
 *
 * Opened from a plate row's name (`plate` names the row), the page is the plate-edit one: it starts on the row's
 * amount and unit, Save puts the row back in its place with the new amount and goes back to the sheet, and
 * Back changes nothing. A `plate` that is not a row of this food goes back to the search.
 *
 * Opened with no day, as from the scanner of the Your foods sheet, which has no plate to put it on, the page
 * is the one that logs: the Time row shows "Now", and Add logs the food, closes the sheet to the diary and
 * shows the toast.
 */
export default function PortionPickerRoute() {
  const router = useRouter();
  const goBack = useGoBackInFoodsSheet();
  const closeSheet = useCloseFoodsSheet();
  const toast = useToast();
  const logFood = useLogFood();
  const isOnline = useIsOnline();
  const plate = usePlate();
  const {
    id,
    barcode,
    day,
    time,
    recent,
    plate: plateKey,
  } = useLocalSearchParams<{
    id: string;
    barcode?: string;
    recent?: string;
    day?: string;
    time?: string;
    plate?: string;
  }>();
  const isValidId = isFoodId(id);
  const state = useFoodWithPortions(isValidId ? id : "");
  // A branded food stored before the current portion rules gets its new portions in the background.
  useRefreshOutdatedOffFood(state.status === "ready" ? state.food : undefined);
  const isReadEnabled = useReadsEnabled();
  const logContext = readLogContext({ day, time });
  const isFromRecent = recent !== undefined;
  const isEditingPlateRow = plateKey !== undefined;
  const plateRow = plate.items.find(
    (item) => item.key === plateKey && item.kind === "food" && item.foodId === id,
  );
  // The diary reads its days and hours in the profile's zone, so a time logged here is read in it, and so is
  // the day Recent says a food was last logged. Putting a food on the plate, or changing a row of it, needs
  // neither, so they work offline.
  const needsTimeZone = !isEditingPlateRow && (logContext === undefined || isFromRecent);
  const profileTimeZone = useProfileTimeZone({ enabled: isReadEnabled && needsTimeZone });
  // The Recent list is the cache the sheet has just drawn it from, so this is not a new request.
  const recentFoods = useRecentFoods({ enabled: isReadEnabled && isFromRecent });
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  // The moment the screen opened, so "Now" does not move while the picker is open.
  const [openedAt] = useState(() => new Date());
  // Set in the same tick as the press, which a state update is not, so a second press cannot add it twice.
  const hasAddedToPlate = useRef(false);
  // The same for Save on a plate row: going back twice would close the whole sheet.
  const hasSavedPlateRow = useRef(false);
  const isStalePlateRow = isEditingPlateRow && plateRow === undefined;

  // A link to a row that is not on the plate, such as one kept from before the plate was cleared, has nothing
  // to change: the search is where it belongs.
  useEffect(() => {
    if (isStalePlateRow) {
      router.dismissTo(withLogContext("/foods", logContext));
    }
  }, [isStalePlateRow, router, logContext]);

  if (isStalePlateRow) {
    return null;
  }

  if (!isValidId) {
    return <FoodLoadState state="notFound" />;
  }

  if (state.status !== "ready") {
    return <FoodLoadState state={state.status} />;
  }

  if (needsTimeZone && profileTimeZone.isError) {
    return <FoodLoadState state="error" />;
  }

  if (
    (needsTimeZone && profileTimeZone.data === undefined) ||
    (isFromRecent && recentFoods.isPending)
  ) {
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

  const note =
    lastLogged === undefined || lastLoggedDay === undefined
      ? barcode === undefined
        ? undefined
        : describeScannedCode(barcode)
      : describeLastLogged(
          describeLoggedAmount(lastLogged.snapshot),
          -lastLoggedDay.daysFromToday,
          lastLoggedDay.label,
        );
  const initialAmount = lastAmount === undefined ? undefined : amountForPicker(lastAmount);

  function handleAddToPlate(amount: ChosenAmount) {
    if (hasAddedToPlate.current) {
      return;
    }
    hasAddedToPlate.current = true;
    const offered = pickerChoices(food, portions).portions;
    plate.add((key) => plateItemOfPickedFood({ key, food, portions: offered, amount }));
    // No toast is drawn after Add to plate, so a screen reader is told instead.
    AccessibilityInfo.announceForAccessibility(describeAddedToPlate(food.name));
    // Back to the search, whatever led here: the scanner and the create form must not stay on top of it.
    router.dismissTo(withLogContext("/foods", logContext));
  }

  function handleSavePlateRow(rowKey: string, amount: ChosenAmount) {
    if (hasSavedPlateRow.current) {
      return;
    }
    hasSavedPlateRow.current = true;
    const offered = pickerChoices(food, portions).portions;
    // The row keeps its key and its place on the plate, and never merges into another row of the same food.
    plate.replace(rowKey, (key) => plateItemOfPickedFood({ key, food, portions: offered, amount }));
    goBack();
  }

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

  if (plateRow?.kind === "food") {
    // The row's amount as the food is now: a portion that has gone comes as the grams or millilitres it was.
    // A row with no valid amount keeps its unit and starts at that unit's usual amount (1, or 100 g or ml).
    const startQuantity = usualQuantityOfUnit(plateRow.unit.kind);
    const rowAmount = plateFoodAmount(
      isPlateItemValid(plateRow)
        ? plateRow
        : { ...plateRow, quantity: startQuantity, quantityText: String(startQuantity) },
      portions,
    );

    return (
      <PortionPicker
        food={food}
        initialAmount={rowAmount === undefined ? undefined : amountForPicker(rowAmount)}
        mode="edit-plate"
        portions={portions}
        onBack={goBack}
        onSubmit={(amount) => {
          handleSavePlateRow(plateRow.key, amount);
        }}
      />
    );
  }

  if (logContext !== undefined) {
    return (
      <PortionPicker
        food={food}
        initialAmount={initialAmount}
        isPlateLogging={plate.isLogging}
        mode="add-to-plate"
        note={note}
        portions={portions}
        onBack={goBack}
        onCopy={() => {
          router.push(`/foods/new?from=${id}`);
        }}
        onSubmit={handleAddToPlate}
      />
    );
  }

  return (
    <PortionPicker
      food={food}
      hasSaveError={hasSaveError}
      isNow
      isOnline={isOnline}
      mode="add"
      isSaving={isSaving}
      initialAmount={initialAmount}
      note={note}
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
