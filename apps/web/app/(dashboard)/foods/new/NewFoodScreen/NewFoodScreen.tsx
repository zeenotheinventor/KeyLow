"use client";

import { FOOD_FORM } from "@keylow/core/copy";
import { useSearchParams } from "next/navigation";

import { CopyFoodScreen } from "../CopyFoodScreen";

import { FoodForm } from "@/components/foods/FoodForm";
import { FoodFormPage } from "@/components/foods/FoodFormPage";
import { isFoodId } from "@/components/foods/isFoodId";

export function NewFoodScreen() {
  const searchParameters = useSearchParams();
  const barcode = searchParameters.get("barcode");
  const fromId = searchParameters.get("from");

  if (fromId !== null && isFoodId(fromId)) {
    return <CopyFoodScreen fromId={fromId} />;
  }

  return (
    <FoodFormPage backLabel={FOOD_FORM.back} title={FOOD_FORM.titles.create}>
      <FoodForm scannedBarcode={barcode === null || barcode === "" ? undefined : barcode} />
    </FoodFormPage>
  );
}
