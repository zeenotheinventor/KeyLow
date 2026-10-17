import { RECIPE_EDITOR, RECIPE_VIEW } from "@keylow/core/copy";
import { View } from "react-native";

import { Button, Card, ServingsStepper, Text } from "../ui";

import type { ServingsCardProps } from "./types";

/**
 * The Servings card of the recipe view: the stepper that chooses how many servings to cook, what that
 * makes, and a way back to the recipe's own servings once they differ. It holds no sums, the view model
 * hands it the words, and nothing in it is ever turned off for being offline, since scaling is
 * arithmetic on the phone. The Reset link is the app's ghost button in the accent ink, as the dashboard's
 * Edit beside a target is, because the kit has no text link of its own.
 */
export function ServingsCard({
  text,
  onChangeText,
  valueText,
  canDecrease,
  canIncrease,
  onStep,
  error,
  fieldRef,
  onBlur,
  yieldLine,
  resetLabel,
  onReset,
}: ServingsCardProps) {
  return (
    <Card aria-label={RECIPE_EDITOR.servings} padding={0} role="region">
      <View className="gap-2 px-4 py-3">
        <ServingsStepper
          canDecrease={canDecrease}
          canIncrease={canIncrease}
          decreaseLabel={RECIPE_VIEW.fewerServings}
          error={error}
          fieldRef={fieldRef}
          increaseLabel={RECIPE_VIEW.moreServings}
          label={RECIPE_EDITOR.servings}
          text={text}
          valueText={valueText}
          onBlur={onBlur}
          onChangeText={onChangeText}
          onStep={onStep}
        />
        <View className="min-h-6 flex-row flex-wrap items-center justify-between gap-x-3">
          <Text tone="secondary" variant="caption">
            {yieldLine}
          </Text>
          {resetLabel === null ? null : (
            // The button reaches the 44 point touch target through its hit slop, and the negative margins keep the row as tall as its text.
            <Button
              className="-mr-2 -my-[6px]"
              icon="RotateCcw"
              size="sm"
              tone="accent-ink"
              variant="ghost"
              onPress={onReset}
            >
              {resetLabel}
            </Button>
          )}
        </View>
      </View>
    </Card>
  );
}
