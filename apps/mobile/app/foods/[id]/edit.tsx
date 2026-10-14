import { useFoodWithPortions, useUpdateFood } from "@keylow/api-client";
import { FOOD_FORM, FOOD_FORM_BUTTONS } from "@keylow/core/copy";
import { isFoodId } from "@keylow/core/foods";
import { useLocalSearchParams, useRouter } from "expo-router";

import { FoodForm, foodToFormValues } from "../../../components/FoodForm";
import { FoodFormScreen } from "../../../components/FoodFormScreen";
import { FoodLoadState } from "../../../components/FoodLoadState";
import { EmptyState } from "../../../components/ui";

import type { CustomFoodInput } from "@keylow/core/schemas";

export default function EditFoodRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  // An id that is not a food id is a food that is not there, so it is never asked for. An empty id is idle.
  const isValidId = isFoodId(id);
  const state = useFoodWithPortions(isValidId ? id : "");
  const updateFood = useUpdateFood();

  async function save(input: CustomFoodInput) {
    await updateFood.mutateAsync({ id, input });
    router.replace(`/foods/${id}`);
  }

  if (!isValidId) {
    return <FoodLoadState state="notFound" />;
  }

  if (state.status !== "ready") {
    return <FoodLoadState state={state.status} />;
  }

  if (state.food.source !== "user") {
    return (
      <FoodFormScreen title={FOOD_FORM.titles.edit}>
        <EmptyState
          body={FOOD_FORM.cannotEdit.body}
          icon="Lock"
          title={FOOD_FORM.cannotEdit.title}
        />
      </FoodFormScreen>
    );
  }

  return (
    <FoodFormScreen title={FOOD_FORM.titles.edit}>
      <FoodForm
        submitLabel={FOOD_FORM_BUTTONS.edit}
        initialValues={foodToFormValues(state.food, state.portions)}
        onSubmit={save}
      />
    </FoodFormScreen>
  );
}
