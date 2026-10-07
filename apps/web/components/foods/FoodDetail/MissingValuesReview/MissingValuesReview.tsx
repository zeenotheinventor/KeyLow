import Link from "next/link";
import { useId } from "react";

import type { MissingValuesReviewProps } from "./types";

import { Button } from "@/components/ui/button";

const FIELD_NAMES: Record<string, string> = {
  kcal: "energy",
  protein_g: "protein",
  fat_g: "fat",
  carbs_g: "carbohydrate",
  fibre_g: "fibre",
};

const listFormat = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });

export function MissingValuesReview({ foodId, fieldsMissing }: MissingValuesReviewProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-md border border-destructive p-4"
    >
      <h2 id={headingId} className="font-semibold">
        Some values are missing
      </h2>
      {fieldsMissing.length > 0 && (
        <p className="text-sm">
          {`Not given by the source: ${listFormat.format(fieldsMissing.map((field) => FIELD_NAMES[field] ?? field))}.`}
        </p>
      )}
      <Button asChild className="h-11 self-start md:h-9">
        <Link href={`/foods/new?from=${foodId}`}>Review and save as my food</Link>
      </Button>
    </section>
  );
}
