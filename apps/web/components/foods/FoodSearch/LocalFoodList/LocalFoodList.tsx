import Link from "next/link";

import type { LocalFoodListProps } from "./types";

import { describeEnergy, SOURCE_LABELS } from "@/components/foods/foodDisplay";

export function LocalFoodList({ foods }: LocalFoodListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {foods.map((food) => (
        <li key={food.id}>
          <Link
            href={`/foods/${food.id}`}
            className="flex min-h-11 flex-col gap-1 rounded-md border p-3 hover:bg-hover-overlay"
          >
            <span className="font-medium">{food.name}</span>
            {food.brand !== null && <span className="text-sm text-text-muted">{food.brand}</span>}
            <span className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <span className="rounded-full border px-2 py-0.5 text-xs">
                {SOURCE_LABELS[food.source]}
              </span>
              <span>{describeEnergy(food)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
