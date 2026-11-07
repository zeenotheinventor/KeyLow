// The words on the buttons of a confirmation, one line per tool that asks for one. The question above
// the buttons is the model's own text when it wrote one, and the tool's own words (`question` in its
// answer, built from the same core functions) when it wrote none, so only the buttons and the tone come
// from here. The code may add a line of its own after that text: a tool's `note`, which the turn loop
// appends (KEY-824). A confirming tool with no line cannot be confirmed in the app, and the loop ends that
// turn as failed.
import { z } from "zod";

import {
  confirmArchiveButtons,
  confirmCopyButtons,
  confirmDeleteButtons,
  confirmTargetsButtons,
  confirmArchiveRoutineButtons,
  confirmArchiveExerciseButtons,
} from "../_shared/core.ts";

export type ConfirmWords = {
  confirmLabel: string;
  cancelLabel: string;
  tone: "danger" | "primary";
};

type WordsFor = (input: unknown) => ConfirmWords | null;

const deleteEntryInput = z.object({ ids: z.array(z.string()).min(1) });
const copyDayInput = z.object({ entry_count: z.number().int().min(1) });
const archiveRecipeInput = z.object({ id: z.string() });
const updateTargetsInput = z.object({ current_kcal: z.number().int().nullable() });
const archiveRoutineInput = z.object({ routine_id: z.string() });
const archiveCustomExerciseInput = z.object({ id: z.string() });

// The buttons of `update_targets` name the number the person keeps, which the tool's input holds as
// `current_kcal`. `needsConfirmation` reads the person's own number and refuses a call that disagrees, so a
// wrong number never reaches a button. Following `copy_day`'s `entry_count`.
const wordsByTool: ReadonlyMap<string, WordsFor> = new Map<string, WordsFor>([
  [
    "delete_entry",
    (input) => {
      const parsed = deleteEntryInput.safeParse(input);
      return parsed.success
        ? { ...confirmDeleteButtons(parsed.data.ids.length), tone: "danger" }
        : null;
    },
  ],
  [
    "copy_day",
    (input) => {
      const parsed = copyDayInput.safeParse(input);
      return parsed.success
        ? { ...confirmCopyButtons(parsed.data.entry_count), tone: "primary" }
        : null;
    },
  ],
  [
    "archive_recipe",
    (input) =>
      archiveRecipeInput.safeParse(input).success
        ? { ...confirmArchiveButtons(), tone: "primary" }
        : null,
  ],
  [
    "update_targets",
    (input) => {
      const parsed = updateTargetsInput.safeParse(input);
      return parsed.success
        ? { ...confirmTargetsButtons(parsed.data.current_kcal), tone: "primary" }
        : null;
    },
  ],
  [
    "archive_routine",
    (input) =>
      archiveRoutineInput.safeParse(input).success
        ? { ...confirmArchiveRoutineButtons(), tone: "primary" }
        : null,
  ],
  [
    "archive_custom_exercise",
    (input) =>
      archiveCustomExerciseInput.safeParse(input).success
        ? { ...confirmArchiveExerciseButtons(), tone: "primary" }
        : null,
  ],
]);

export function confirmWordsFor(tool: string, input: unknown): ConfirmWords | null {
  return wordsByTool.get(tool)?.(input) ?? null;
}
