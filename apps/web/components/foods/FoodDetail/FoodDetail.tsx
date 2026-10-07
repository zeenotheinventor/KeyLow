"use client";

import { requiresConfirmation, DATA_SOURCE_ATTRIBUTION } from "@keylow/core/foods";
import Link from "next/link";

import { MissingValuesReview } from "./MissingValuesReview";
import { NutrientTable } from "./NutrientTable";
import { PortionList } from "./PortionList";
import { BASIS_LABELS, SOURCE_LABELS } from "../foodDisplay";
import { FoodLoadNotice } from "../FoodLoadNotice";
import { useFoodWithPortions } from "../useFoodWithPortions";

import type { FoodDetailProps } from "./types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const US_CARBS_NOTE =
  "Carbohydrate here is the US total, which includes fibre, so it can read higher than a UK label.";

export function FoodDetail({ id }: FoodDetailProps) {
  const state = useFoodWithPortions(id);

  if (state.kind !== "ready") {
    return <FoodLoadNotice state={state} />;
  }

  const { food, portions } = state;
  const attribution = food.source === "user" ? null : DATA_SOURCE_ATTRIBUTION[food.source];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Button asChild variant="outline" className="h-11 self-start md:h-9">
        <Link href="/foods">Back to foods</Link>
      </Button>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{food.name}</h1>
        {food.brand !== null && <p className="text-muted-foreground">{food.brand}</p>}
      </div>

      {requiresConfirmation(food) && (
        <MissingValuesReview foodId={food.id} fieldsMissing={food.quality.fields_missing ?? []} />
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Source</dt>
        <dd>{SOURCE_LABELS[food.source]}</dd>
        <dt className="text-muted-foreground">Basis</dt>
        <dd>{BASIS_LABELS[food.basis]}</dd>
      </dl>

      <Card className="p-4 md:p-6">
        <NutrientTable food={food} />
      </Card>
      {food.quality.carbs_convention === "us_total" && (
        <p className="text-sm text-muted-foreground">{US_CARBS_NOTE}</p>
      )}

      {portions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Portions</h2>
          <PortionList portions={portions} />
        </section>
      )}

      {attribution !== null && (
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>{attribution.text}</p>
          <a
            href={attribution.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center break-all underline underline-offset-4 md:min-h-0"
          >
            {attribution.url}
          </a>
        </div>
      )}

      {food.source === "user" && (
        <Link
          href={`/foods/${food.id}/edit`}
          className="inline-flex min-h-11 items-center self-start text-sm font-medium underline underline-offset-4 md:min-h-0"
        >
          Edit
        </Link>
      )}
    </div>
  );
}
