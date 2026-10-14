import type { Food } from "@keylow/core/schemas";

export type FoodHeaderProps = {
  food: Pick<Food, "name" | "brand" | "source">;
};
