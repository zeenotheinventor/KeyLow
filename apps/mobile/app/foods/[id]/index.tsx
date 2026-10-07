import { useFood, useFoodPortions } from "@keylow/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";

import { FoodDetail } from "../../../components/FoodDetail";
import { FoodLoadState } from "../../../components/FoodLoadState";

export default function FoodDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const food = useFood(id);
  const portions = useFoodPortions(id);

  // A refresh that fails while the food is on show must not replace it with an error.
  if (
    (food.isError && food.data === undefined) ||
    (portions.isError && portions.data === undefined)
  ) {
    return <FoodLoadState state="error" />;
  }

  if (food.isPending || portions.isPending) {
    return <FoodLoadState state="loading" />;
  }

  if (food.data === null) {
    return <FoodLoadState state="notFound" />;
  }

  return (
    <FoodDetail
      food={food.data}
      portions={portions.data}
      onEdit={() => {
        router.push(`/foods/${id}/edit`);
      }}
      onReview={() => {
        router.push(`/foods/new?from=${id}`);
      }}
    />
  );
}
