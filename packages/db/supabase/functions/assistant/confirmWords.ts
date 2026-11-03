// The words on the buttons of a confirmation, one line per tool that asks for one. The question above
// the buttons is the model's own text, so only the buttons and the tone come from here. A confirming
// tool with no line cannot be confirmed in the app, and the loop ends that turn as failed.
import { z } from "zod";

import { confirmDeleteButtons } from "../_shared/core.ts";

export type ConfirmWords = {
  confirmLabel: string;
  cancelLabel: string;
  tone: "danger" | "primary";
};

type WordsFor = (input: unknown) => ConfirmWords | null;

const deleteEntryInput = z.object({ ids: z.array(z.string()).min(1) });

// KEY-693, KEY-694 and KEY-697 add a line for each confirming tool they build.
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
]);

export function confirmWordsFor(tool: string, input: unknown): ConfirmWords | null {
  return wordsByTool.get(tool)?.(input) ?? null;
}
