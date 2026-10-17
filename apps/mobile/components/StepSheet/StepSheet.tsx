import {
  RECIPE_EDITOR,
  RECIPE_PROBLEMS,
  STEP_SHEET,
  describeStepLength,
  describeStepTextName,
  describeStepTitle,
} from "@keylow/core/copy";
import { isStepTooLong } from "@keylow/core/recipes";
import { View } from "react-native";

import { BottomSheet, Button, TextArea } from "../ui";

import type { StepSheetProps } from "./types";

/**
 * The sheet that edits one step of the recipe's method, or writes a new one: the step's title, a text area
 * with the count of its characters, Done (Add step for a new step) and, for a step that is in the method,
 * Remove step. Past the most characters a step holds the count and the sentence turn to danger and Done is
 * off. It holds no text of its own: the editor does, so closing the sheet any way keeps what was typed.
 */
export function StepSheet({
  open,
  number,
  isNew,
  isDismissible,
  text,
  onChangeText,
  onDone,
  onRemove,
  onClose,
}: StepSheetProps) {
  const isTooLong = isStepTooLong(text);

  return (
    <BottomSheet
      isDismissible={isDismissible}
      isTitleCentred
      open={open}
      title={describeStepTitle(number)}
      onClose={onClose}
    >
      <View className="gap-3">
        <TextArea
          autoFocus
          counter={describeStepLength(text)}
          error={isTooLong ? RECIPE_PROBLEMS.stepTooLong : undefined}
          isOverLimit={isTooLong}
          label={describeStepTextName(number)}
          placeholder={STEP_SHEET.placeholder}
          value={text}
          onChangeText={onChangeText}
        />
        <View className="gap-1">
          <Button fullWidth disabled={isTooLong} size="lg" onPress={onDone}>
            {isNew ? RECIPE_EDITOR.addStep : STEP_SHEET.done}
          </Button>
          {isNew ? null : (
            <Button fullWidth icon="Trash2" tone="danger" variant="ghost" onPress={onRemove}>
              {STEP_SHEET.remove}
            </Button>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}
