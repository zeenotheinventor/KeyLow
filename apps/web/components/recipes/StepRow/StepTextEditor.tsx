import {
  ADD_FOOD_DIALOG,
  RECIPE_EDITOR,
  RECIPE_PROBLEMS,
  STEP_SHEET,
  describeStepLength,
  describeStepTextName,
} from "@keylow/core/copy";
import { isStepTooLong } from "@keylow/core/recipes";
import { useEffect } from "react";

import type { StepTextEditorProps } from "./types";

import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";

/**
 * The field a step is edited or written in, with the count of its characters and Done (Add step for a new
 * step) and Cancel. Past the most characters a step holds the count and the sentence say so and Done is off.
 * The cursor starts after the text.
 */
export function StepTextEditor({ number, editor }: StepTextEditorProps) {
  const { textAreaRef } = editor;
  const isTooLong = isStepTooLong(editor.text);

  useEffect(() => {
    const field = textAreaRef.current;
    if (field !== null) {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }
  }, [textAreaRef]);

  return (
    <div className="min-w-0 flex-1">
      <TextArea
        ref={textAreaRef}
        hideLabel
        label={describeStepTextName(number)}
        placeholder={STEP_SHEET.placeholder}
        value={editor.text}
        onChange={(event) => {
          editor.onChangeText(event.target.value);
        }}
        counter={describeStepLength(editor.text)}
        isOverLimit={isTooLong}
        error={isTooLong ? RECIPE_PROBLEMS.stepTooLong : undefined}
        footer={
          <>
            <Button type="button" size="sm" disabled={isTooLong} onClick={editor.onDone}>
              {editor.isNew ? RECIPE_EDITOR.addStep : STEP_SHEET.done}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={editor.onCancel}>
              {ADD_FOOD_DIALOG.cancel}
            </Button>
          </>
        }
      />
    </div>
  );
}
