"use client";

import { useSearchParams } from "next/navigation";

import { FoodForm } from "@/components/foods/FoodForm";

export function NewFoodScreen() {
  const barcode = useSearchParams().get("barcode");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">New food</h1>
      <FoodForm scannedBarcode={barcode === null || barcode === "" ? undefined : barcode} />
    </div>
  );
}
