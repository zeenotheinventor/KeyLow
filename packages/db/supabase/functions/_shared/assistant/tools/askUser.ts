// The way the model asks one question instead of guessing. The turn loop turns this call into a
// `clarify` event for the app and never sends it to the server, so `run` is only reachable from a caller
// outside the loop. Nothing here reads or writes the database.
import { z } from "zod";

import type { ReadToolDefinition } from "../tool.ts";

const askUserInput = z.strictObject({
  question: z.string().min(1).describe("The one question to ask, short and in plain words."),
  quick_replies: z
    .array(z.string().min(1))
    .max(3)
    .describe("Up to 3 answers the user can tap. An empty list when none fits."),
});

export const askUserTool: ReadToolDefinition<z.infer<typeof askUserInput>> = {
  name: "ask_user",
  description:
    "Asks the user one question when an amount, a food or a day is unclear, instead of guessing. " +
    "Ask only one question at a time. The quick replies are the food's own portions, an amount in grams or an " +
    'exercise name, written as the user would say it, for example "1 chicken breast" or "150 g rice", never a ' +
    "hand measure such as a fist, a palm or a thumb. For a training goal, each reply gives the goal and " +
    'the experience together, such as "Look better, intermediate". ' +
    "The user's answer arrives as their next message, " +
    "so end the turn after this call and do not call another tool in the same turn.",
  kind: "read",
  input: askUserInput,
  annotations: { readOnlyHint: true },
  run: () => Promise.resolve({ data: { status: "asked" } }),
};
