import { z } from "zod";

/*
 * Why a recipe the assistant was asked for did not come (`assistant-card · recipe-draft-failed`). The tools
 * `suggest_recipe` and `adjust_recipe` send one when their generation ends timed out or refused, and the app draws
 * it as a notice under the reply. It is not a stream notice (`notice.ts`): those are the gates of the whole
 * assistant, and a recipe that did not come leaves the assistant working. It has its own event and its own key in
 * a stored tool result, so an app that is behind skips it, as it skips any event or key it does not know.
 *
 * Not strict, so a field a later version adds is stripped by an app that is behind. A code a later version adds
 * fails to read, and that is dropped on its own where it is stored.
 */
export const assistantRecipeNoticeSchema = z.object({
  /** `timed_out` offers Try again. `refused` is the request being turned down, which sending it again would not change. */
  code: z.enum(["timed_out", "refused"]),
});

export type AssistantRecipeNotice = z.infer<typeof assistantRecipeNoticeSchema>;

/**
 * The notice for the error a recipe tool answered, or null for an error the model words on its own. The three
 * generation outcomes the board draws are a timeout (the generation's own, or the tool's whole deadline) and a
 * refusal. A generation that failed in some other way, a recipe that mentions an avoided food and a recipe that
 * could not be matched to foods have no board.
 */
export function recipeNoticeOfToolError(error: string): AssistantRecipeNotice | null {
  switch (error) {
    case "timed_out":
    case "generation_timeout":
      return { code: "timed_out" };
    case "generation_refused":
      return { code: "refused" };
    default:
      return null;
  }
}
