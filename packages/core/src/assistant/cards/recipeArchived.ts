import {
  describeRecipeArchivedTitle,
  describeRecipeArchivedUndone,
} from "../../copy/assistantRecipeCards";

import type { AssistantCardDraft } from "./entryCardEntry";

/** The card after an `archive_recipe`: "Archived recipe Pasta bake", with Undo that restores it. */
export function buildRecipeArchivedCard({ name }: { name: string }): AssistantCardDraft {
  return {
    kind: "recipe_archived",
    title: describeRecipeArchivedTitle(name),
    sub: null,
    rows: [],
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: describeRecipeArchivedUndone(name),
  };
}
