import type { Food } from "@keylow/core/schemas";

export type FoodHeaderProps = {
  food: Pick<Food, "id" | "name" | "brand" | "source">;
};
