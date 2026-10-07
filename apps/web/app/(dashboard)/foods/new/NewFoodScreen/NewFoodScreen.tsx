"use client";

import { useSearchParams } from "next/navigation";

import { CopyFoodScreen } from "../CopyFoodScreen";

import { FoodForm } from "@/components/foods/FoodForm";
import { isFoodId } from "@/components/foods/isFoodId";

export function NewFoodScreen() {
  const searchParameters = useSearchParams();
  const barcode = searchParameters.get("barcode");
  const fromId = searchParameters.get("from");

  if (fromId !== null && isFoodId(fromId)) {
    return <CopyFoodScreen fromId={fromId} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">New food</h1>
      <FoodForm scannedBarcode={barcode === null || barcode === "" ? undefined : barcode} />
    </div>
  );
}
