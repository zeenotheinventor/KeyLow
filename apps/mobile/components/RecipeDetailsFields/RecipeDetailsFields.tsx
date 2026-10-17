import {
  FOOD_FORM,
  RECIPE_EDITOR,
  describeCookedWeightHelper,
  describeServingsFieldSuffix,
} from "@keylow/core/copy";
import { View } from "react-native";

import { Input, NumericInput, Text } from "../ui";

import type { RecipeDetailsFieldsProps } from "./types";

/**
 * The Details section of the recipe editor: the name, the servings and the cooked weight. The helper under
 * the cooked weight says what a blank one means, and gives way to the sentence when the weight is wrong.
 */
export function RecipeDetailsFields({
  draft,
  errors,
  isLocked,
  onChange,
  nameRef,
  servingsRef,
  cookedWeightRef,
}: RecipeDetailsFieldsProps) {
  return (
    <View className="gap-2">
      <Text className="px-1" role="heading" variant="body-strong">
        {FOOD_FORM.details}
      </Text>
      <View className="gap-3">
        <Input
          autoCapitalize="sentences"
          density="compact"
          disabled={isLocked}
          error={errors.name}
          inputRef={nameRef}
          label={FOOD_FORM.name}
          placeholder={RECIPE_EDITOR.namePlaceholder}
          value={draft.name}
          onChangeText={(text) => {
            onChange("name", text);
          }}
        />
        <NumericInput
          accessibilityLabel={RECIPE_EDITOR.servings}
          disabled={isLocked}
          error={errors.servings}
          inputRef={servingsRef}
          label={RECIPE_EDITOR.servings}
          placeholder=""
          unit={describeServingsFieldSuffix(draft.servings)}
          value={draft.servings}
          onChangeText={(text) => {
            onChange("servings", text);
          }}
        />
        <NumericInput
          accessibilityLabel={RECIPE_EDITOR.cookedWeightName}
          disabled={isLocked}
          error={errors.cookedWeight}
          helper={describeCookedWeightHelper(draft.ingredients)}
          inputRef={cookedWeightRef}
          label={RECIPE_EDITOR.cookedWeight}
          placeholder=""
          unit="g"
          value={draft.cookedWeight}
          onChangeText={(text) => {
            onChange("cookedWeight", text);
          }}
        />
      </View>
    </View>
  );
}
