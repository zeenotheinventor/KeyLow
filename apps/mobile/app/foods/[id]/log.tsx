import { useFoodWithPortions, useLogFood } from "@keylow/api-client";
import { ADDED_TOAST, describeScannedCode } from "@keylow/core/copy";
import { isFoodId } from "@keylow/core/foods";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { FoodLoadState } from "../../../components/FoodLoadState";
import { PortionPicker } from "../../../components/PortionPicker";
import { useToast } from "../../../components/ui";
import { deviceTimeZone } from "../../../lib/deviceTimeZone";
import { clockTimeOn, openingLoggedAt } from "../../../lib/loggedAt";
import { readLogContext, useCloseFoodsSheet, useGoBackInFoodsSheet } from "../../../lib/navigation";

import type { PortionSelection } from "../../../components/PortionPicker";

/**
 * The portion picker: a food's page for changing the serving before it is logged. It reads `day` and `time`
 * as the food sheet carries them, so the Time row shows the hour an hour's plus was pressed on ("12:00") or
 * "Now" with the current time, and `barcode` when a scan opened it. Add logs the food at the time the row
 * shows, closes the sheet to the diary and shows the toast.
 */
export default function PortionPickerRoute() {
  const router = useRouter();
  const goBack = useGoBackInFoodsSheet();
  const closeSheet = useCloseFoodsSheet();
  const toast = useToast();
  const logFood = useLogFood();
  const { id, barcode, day, time } = useLocalSearchParams<{
    id: string;
    barcode?: string;
    day?: string;
    time?: string;
  }>();
  const isValidId = isFoodId(id);
  const state = useFoodWithPortions(isValidId ? id : "");
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  // The moment the screen opened, so "Now" does not move while the picker is open.
  const [openedAt] = useState(() => new Date());
  const timeZone = deviceTimeZone();
  const logContext = readLogContext({ day, time });
  const initial = openingLoggedAt(openedAt, logContext, timeZone);

  if (!isValidId) {
    return <FoodLoadState state="notFound" />;
  }

  if (state.status !== "ready") {
    return <FoodLoadState state={state.status} />;
  }

  const { food, portions } = state;

  async function handleSubmit(selection: PortionSelection) {
    setIsSaving(true);
    setHasSaveError(false);
    const { loggedAt, localDate } = selection.isNow
      ? initial
      : clockTimeOn(initial.localDate, selection.time, timeZone);
    try {
      await logFood.mutateAsync({
        food,
        quantity: selection.quantity,
        unit: selection.unit,
        ...(selection.unit === "portion" ? { portion: selection.portion } : {}),
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
      isSaving={isSaving}
      note={barcode === undefined ? undefined : describeScannedCode(barcode)}
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
