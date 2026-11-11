// Which tools a turn may call, chosen in code from the person's message before any model runs (ADR 0006 a).
// The model never picks its own set. The sets come from the tools' annotations, so a tool added later lands
// in the right one with no edit here, and anything the rules cannot tell falls to the general set, which
// still has every executor guard. The answer keeps the tools' own order, so the `X-Kilo-Allowed-Tools`
// header is the same for the same input.
import type { ListedTool } from "../_shared/assistant/mcpClient.ts";

export type AllowlistTool = Pick<ListedTool, "name" | "readOnlyHint">;

export type AllowlistInput = {
  text: string;
  // The tool of a confirmation the previous turn left waiting, or null.
  pendingConfirmationTool: string | null;
  tools: readonly AllowlistTool[];
};

const importToolName = "import_recipe_from_url";

// The one write the read set holds (ADR 0006, Amendment 4). A question about a feature Ki-Lo lacks is
// read-shaped, and the offer to send a feature request is needed exactly then. It is safe here because it
// writes only after the person presses its confirm button and touches no diary or training row.
const featureRequestToolName = "request_feature";

// The tools a recipe link needs, each only if it is listed.
const recipeImportTools: ReadonlySet<string> = new Set([
  importToolName,
  "search_foods",
  "get_food",
  "create_recipe",
  "ask_user",
]);

// A link with a scheme, one that starts with www, or a bare domain with a path. The import tool still
// accepts only a URL that appears word for word in the message.
const linkPattern = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/\S*/i;

// How a message must open to count as a read. Anything else is not a read, because a request can be
// worded as a question ("Same as yesterday?") and a write left out of the set cannot be done at all.
// "How about" and "what about" offer something to log, so they are not reads.
const readOpening = new RegExp(
  "^(?!(?:how|what) about\\b)(?:what|when|where|which|who|whom|whose|why|how|is|are|am|was|were|do|does|did|should)\\b",
  "i",
);

// Words that ask for a change or report food eaten, with the forms a person types. A word counts at its
// start, so "dataset" does not hold "set". A stem that ends in `\w*` takes any ending.
const changeWords = [
  "log(?:s|ged|ging)?",
  "add(?:s|ed|ing)?",
  "delet\\w*",
  "remov\\w*",
  "cop(?:y|ies|ied|ying)",
  "chang\\w*",
  "updat\\w*",
  "set(?:s|ting)?",
  "mak(?:e|es|ing)",
  "made",
  "creat\\w*",
  "archiv\\w*",
  "undo\\w*",
  "undid",
  "mark(?:s|ed|ing)?",
  "put(?:s|ting)?",
  "record\\w*",
  "track\\w*",
  "sav(?:e|es|ed|ing)",
  "stor(?:e|es|ed|ing)",
  "enter(?:s|ed|ing)?",
  "insert\\w*",
  "includ(?:e|es|ed|ing)",
  "edit\\w*",
  "swap\\w*",
  "replac\\w*",
  "fix\\w*",
  "correct\\w*",
  "mov(?:e|es|ed|ing)",
  "renam\\w*",
  "reset\\w*",
  "clear\\w*",
  "drop(?:s|ped|ping)?",
  "cancel\\w*",
  "bump\\w*",
  "increas\\w*",
  "decreas\\w*",
  "reduc\\w*",
  "adjust\\w*",
  "modif\\w*",
  "duplicat\\w*",
  "restor\\w*",
  "eras\\w*",
  "wip(?:e|es|ed|ing)",
  "ate",
  "had",
  "drank",
];

// A polite request or a statement of intent ("Can you ...", "Please ...", "I want ...") asks for something
// whatever verb follows.
const requestPhrases = [
  "(?:can|could|would|will) you",
  "please",
  "i (?:want|need|wish)",
  "i would like",
  "i'd like",
  "i wanna",
];

const changePattern = new RegExp(`\\b(?:${changeWords.join("|")})\\b`, "i");
const requestPattern = new RegExp(`\\b(?:${requestPhrases.join("|")})\\b`, "i");

// A sentence end followed by more text, or a line break, means the message holds more than one thing.
const severalParts = /[.!?]\s+\S|\n/;

// A read only when it positively looks like one: one sentence that opens with a read word and holds
// no request phrase and no change word. When in doubt it is not a read, and the general set has every
// executor guard.
function looksLikeRead(text: string): boolean {
  const trimmed = text.trim();
  return (
    !severalParts.test(trimmed) &&
    readOpening.test(trimmed) &&
    !requestPattern.test(trimmed) &&
    !changePattern.test(trimmed)
  );
}

export function allowedToolsFor({
  text,
  pendingConfirmationTool,
  tools,
}: AllowlistInput): string[] {
  const inSet = (tool: AllowlistTool): boolean => {
    if (tool.name === pendingConfirmationTool) {
      return true;
    }
    if (linkPattern.test(text)) {
      return recipeImportTools.has(tool.name);
    }
    if (looksLikeRead(text)) {
      return tool.readOnlyHint || tool.name === featureRequestToolName;
    }
    return tool.name !== importToolName;
  };
  return tools.filter(inSet).map((tool) => tool.name);
}
