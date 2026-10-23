import { useFoodWithPortions, useRefreshOutdatedOffFood } from "@keylow/api-client";
import { isFoodId } from "@keylow/core/foods";
import { useLocalSearchParams, useRouter } from "expo-router";

import { FoodDetail } from "../../../components/FoodDetail";
import { FoodLoadState } from "../../../components/FoodLoadState";

export default function FoodDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  // An id that is not a food id is a food that is not there, so it is never asked for. An empty id is idle.
  const isValidId = isFoodId(id);
  const state = useFoodWithPortions(isValidId ? id : "");
  // A branded food stored before the current portion rules gets its new portions in the background.
  useRefreshOutdatedOffFood(state.status === "ready" ? state.food : undefined);

  if (!isValidId) {
    return <FoodLoadState state="notFound" />;
  }

  if (state.status !== "ready") {
    return <FoodLoadState state={state.status} />;
  }

  return (
    <FoodDetail
      food={state.food}
      portions={state.portions}
      onEdit={() => {
        router.push(`/foods/${id}/edit`);
      }}
      onCopy={() => {
        router.push(`/foods/new?from=${id}`);
      }}
    />
  );
}
