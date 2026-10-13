"use client";

import { useFoodByBarcode } from "@keylow/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { BarcodeResultProps } from "./types";
import type { FoodByBarcodeError } from "@keylow/api-client";

import { describeRateLimit } from "@/components/foods/foodDisplay";

function describeError(error: FoodByBarcodeError): string {
  return error.kind === "rate_limited"
    ? describeRateLimit(error.retryAfterSeconds)
    : `The barcode could not be looked up: ${error.message}`;
}

export function BarcodeResult({ code }: BarcodeResultProps) {
  const router = useRouter();
  const { result, isLoading, error } = useFoodByBarcode(code);
  const foundFoodId = result?.status === "found" ? result.food.id : undefined;

  useEffect(() => {
    if (foundFoodId !== undefined) {
      router.push(`/foods/${foundFoodId}`);
    }
  }, [foundFoodId, router]);

  if (foundFoodId !== undefined) {
    return (
      <p role="status" className="text-sm text-text-muted">
        Opening the food
      </p>
    );
  }

  if (error !== null) {
    return (
      <p role="alert" className="text-sm text-danger">
        {describeError(error)}
      </p>
    );
  }

  if (isLoading) {
    return (
      <p role="status" className="text-sm text-text-muted">
        Looking up the barcode
      </p>
    );
  }

  if (result?.status === "not_found") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">Not in the database</p>
        <Link
          href={`/foods/new?barcode=${result.code}`}
          className="inline-flex min-h-11 items-center self-start text-sm font-medium underline underline-offset-4 md:min-h-0"
        >
          Create food with this barcode
        </Link>
      </div>
    );
  }

  return null;
}
