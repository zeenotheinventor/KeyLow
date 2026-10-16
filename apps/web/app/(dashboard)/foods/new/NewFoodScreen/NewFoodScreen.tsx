"use client";

import { FOOD_FORM } from "@keylow/core/copy";
import { isCalendarDay } from "@keylow/core/dates";
import { isFoodId } from "@keylow/core/foods";
import { useSearchParams } from "next/navigation";

import { CopyFoodScreen } from "../CopyFoodScreen";

import { FoodForm } from "@/components/foods/FoodForm";
import { FoodFormPage } from "@/components/foods/FoodFormPage";
import { useFoodLogActions } from "@/lib/foodLogActions";

export function NewFoodScreen() {
  const searchParameters = useSearchParams();
  const { openAddFoodOnNextPage } = useFoodLogActions();
  const barcode = searchParameters.get("barcode");
  const fromId = searchParameters.get("from");
  const day = searchParameters.get("day");
  const scannedBarcode = barcode === null || barcode === "" ? undefined : barcode;
  const scannedDay = day !== null && isCalendarDay(day) ? day : undefined;

  // A food made for a scanned barcode is added to the diary next, as a food found by that barcode is.
  // A plain new food ends on its own page.
  function addToDiaryIfScanned(foodId: string) {
    if (scannedBarcode !== undefined) {
      openAddFoodOnNextPage(
        { foodId, ...(scannedDay === undefined ? {} : { date: scannedDay }) },
        `/foods/${foodId}`,
      );
    }
  }

  if (fromId !== null && isFoodId(fromId)) {
    return <CopyFoodScreen fromId={fromId} />;
  }

  return (
    <FoodFormPage backLabel={FOOD_FORM.back} title={FOOD_FORM.titles.create}>
      <FoodForm scannedBarcode={scannedBarcode} onCreated={addToDiaryIfScanned} />
    </FoodFormPage>
  );
}
