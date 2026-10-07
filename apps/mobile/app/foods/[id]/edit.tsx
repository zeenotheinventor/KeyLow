import { useFood, useFoodPortions, useUpdateFood } from "@keylow/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";

import { FoodForm, foodToFormValues } from "../../../components/FoodForm";

import type { CustomFoodInput } from "@keylow/core/schemas";

export default function EditFoodRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const food = useFood(id);
  const portions = useFoodPortions(id);
  const updateFood = useUpdateFood();

  async function save(input: CustomFoodInput) {
    await updateFood.mutateAsync({ id, input });
    router.replace(`/foods/${id}`);
  }

  if (food.isError || portions.isError) {
    return (
      <View className="flex-1 bg-neutral-50 px-6 py-6">
        <Text accessibilityRole="alert" className="text-base text-danger-600">
          The food could not be loaded. Try again later.
        </Text>
      </View>
    );
  }

  if (food.isPending || portions.isPending) {
    return (
      <View className="flex-1 bg-neutral-50 px-6 py-6">
        <Text accessibilityLiveRegion="polite" className="text-base text-neutral-500">
          Loading food
        </Text>
      </View>
    );
  }

  if (food.data === null) {
    return (
      <View className="flex-1 gap-2 bg-neutral-50 px-6 py-6">
        <Text accessibilityRole="header" className="text-2xl font-semibold text-neutral-900">
          Food not found
        </Text>
        <Text className="text-base text-neutral-500">
          This food does not exist, or you cannot see it.
        </Text>
      </View>
    );
  }

  if (food.data.source !== "user") {
    return (
      <View className="flex-1 bg-neutral-50 px-6 py-6">
        <Text className="text-base text-neutral-500">
          This food comes from a shared database and cannot be edited.
        </Text>
      </View>
    );
  }

  return (
    <FoodForm
      submitLabel="Save changes"
      initialValues={foodToFormValues(food.data, portions.data)}
      onSubmit={save}
    />
  );
}
