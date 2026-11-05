// The call a confirm button runs (KEY-840). When the person presses the button, the decision has been made, so
// the turn loop makes the call itself and no model can decline it. The input is never stored a second time:
// the asking turn's own `tool_use` block holds it, and the row that answered that block holds
// `display = { [tool_use_id]: { confirm: { confirmationId } } }`, so the pending id leads to the block.
//
// The executor stays the guard. This only supplies the input, and `runWrite` still checks the tool, the hash,
// the id, the person's stored words and the slot. Nothing here logs or reports the input.
import { z } from "zod";

import type { PreviousTurn, StoredMessage } from "./turnStore.ts";

const toolUseBlockSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
});
const contentSchema = z.array(z.looseObject({ type: z.string() }));
const displaySchema = z.record(
  z.string(),
  z.looseObject({ confirm: z.looseObject({ confirmationId: z.string() }).optional() }),
);

// The id of the call in the row that answered it, found by the confirmation it holds.
function askedCallId(history: readonly StoredMessage[], confirmationId: string): string | null {
  for (const row of history) {
    const display = displaySchema.safeParse(row.display);
    if (row.role === "user" && display.success) {
      for (const [toolUseId, entry] of Object.entries(display.data)) {
        if (entry.confirm?.confirmationId === confirmationId) {
          return toolUseId;
        }
      }
    }
  }
  return null;
}

export type ConfirmedCall = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

// A new call to make, or null when any part of the stored one is missing. The id is new because the API
// refuses a repeated `tool_use` id. `confirmation_id` is the pending id, as a model that copied it would send.
export function confirmedCallOf(
  history: readonly StoredMessage[],
  previousTurn: PreviousTurn | null,
): ConfirmedCall | null {
  const confirmationId = previousTurn?.pendingConfirmationId ?? null;
  const toolName = previousTurn?.pendingTool ?? null;
  if (confirmationId === null || toolName === null) {
    return null;
  }
  const toolUseId = askedCallId(history, confirmationId);
  if (toolUseId === null) {
    return null;
  }
  for (const row of history) {
    const content = contentSchema.safeParse(row.content);
    if (row.role !== "assistant" || !content.success) {
      continue;
    }
    for (const block of content.data) {
      const asked = toolUseBlockSchema.safeParse(block);
      if (asked.success && asked.data.id === toolUseId && asked.data.name === toolName) {
        return {
          type: "tool_use",
          id: `toolu_${crypto.randomUUID().replaceAll("-", "")}`,
          name: asked.data.name,
          input: { ...asked.data.input, confirmation_id: confirmationId },
        };
      }
    }
  }
  return null;
}
