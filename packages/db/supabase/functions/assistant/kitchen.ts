// The hidden kitchen tool group (ADR 0006, Amendment 5). The kitchen tools stay in `tools[]` with
// `defer_loading`, so the array is the same bytes on every turn, and the model sees them only after code
// appends one stored system message that names them with `tool_addition` blocks. The model never decides this.
// A turn is a kitchen turn when the person's words match the list below or the app opened the sheet from the
// Plan or recipe screen (`entry`). The message is stored like any other row, so a replay sends it as it was, and
// it is sticky: every later request of the conversation still holds it. Nothing here logs or reports a message.
import type Anthropic from "@anthropic-ai/sdk";

// The beta the API needs for `tool_addition` and for a request whose `tools[]` holds a deferred tool.
export const KITCHEN_BETA = "mid-conversation-tool-changes-2026-07-01";

// Where the app opened the sheet from, when it did: the Plan screen or a recipe.
export type KitchenEntry = "plan" | "recipe";

// The words of a kitchen request, as a person types them. The list is a judgement and not a measurement, so it
// is kept narrow: a diary or recipe-saving sentence ("create a recipe called ...", "I need more protein today")
// must not surface the kitchen rules, because the rules push a model towards the kitchen tools.
const kitchenPhrases: readonly RegExp[] = [
  // Plans. "a meal plan from my dietitian" and "plan my week of training" are not asks for one.
  /\b(?:make|create|build|write|give|need|want|get|generate|plan|put together)\b[^.?!]{0,25}\bmeal[ -]?plans?\b/i,
  /\bmeal[ -]?plan(?:ning)?\s+for\b/i,
  /\bplan\s+(?:(?:my|our|the|this|next|some)\s+)?(?:(?:week'?s?|day'?s?)\s+)?(?:meals?|dinners?|lunch(?:es)?|breakfasts?|menu|food|eating)\b/i,
  /\bre-?plan\b/i,
  /\bweekly\s+(?:menu|plan)\b/i,
  // A new recipe. "give me the macros for my chicken recipe" and "any recipe I saved" are not.
  /\b(?:suggest|recommend|invent|come up with|think of)\b(?:\s+me)?\s+(?:a|an|some|another|any|new)\b[^.?!]{0,25}\b(?:recipes?|(?:dinner|lunch|breakfast|snack|meal)\s+ideas?)\b/i,
  /\b(?:recipe|dinner|lunch|breakfast|snack|meal)\s+(?:ideas?|suggestions?)\b/i,
  // "dinner around 650" and "lunch of about 500 kcal", never a clock time such as "lunch around 13:00".
  /\b(?:dinner|lunch|breakfast|snack|meal)s?\s+(?:of\s+)?(?:around|about|under|at about|at around|for about)\s+(?:\d{2,4}\s*(?:k?cals?|calories)\b|\d{3,4}\b(?!\s*:\s*\d)(?!\s*[ap]\.?m))/i,
  /\bwhat\s+should\s+i\s+cook\b/i,
  /\bwhat\s+(?:should|shall|can|could)\s+i\s+(?:cook|eat|have|make)\s+(?:for\s+(?:dinner|lunch|breakfast|tea|supper)|today|tonight|tomorrow|this week)\b/i,
  // An adjustment of a recipe. "What's higher in protein, chicken or beef?" is a question about foods.
  /\b(?:make|get)\s+(?:it|this|that|the recipe|this recipe|that recipe|my recipe)\b[^.?!]{0,30}\b(?:higher|lower)\s+in\b/i,
  /\b(?:can|could)\s+(?:it|this|that)\s+(?:be|get)\s+(?:higher|lower)\s+in\b/i,
  /\b(?:recipe|dish)\b[^.?!]{0,30}\b(?:higher|lower)\s+in\s+(?:protein|carbs?|fats?|calories|fibre|fiber|sugar)\b/i,
  /\bcut\s+(?:down\s+)?(?:on\s+)?(?:the\s+)?(?:carbs?|fat|sugar|calories)\b/i,
  // What the person usually eats and what they avoid.
  /\bwhat\s+do\s+i\s+(?:usually|normally|typically|often|mostly)\s+eat\b/i,
  /\bmy\s+palate\b/i,
  /\bfoods?\s+(?:do\s+)?(?:i|to)\s+(?:avoid|dislike|don'?t\s+like)\b/i,
];

export function isKitchenRequest(text: string, entry: KitchenEntry | null | undefined): boolean {
  if (entry !== null && entry !== undefined) {
    return true;
  }
  const plain = text.replaceAll("’", "'");
  return kitchenPhrases.some((phrase) => phrase.test(plain));
}

// The function secret `ASSISTANT_KITCHEN`. Unset, empty or anything but 1 or true is off, so a typo never
// surfaces tools whose cards have not reached phones.
export function isKitchenSwitchOn(value: string | undefined): boolean {
  const word = value?.trim().toLowerCase();
  return word === "1" || word === "true";
}

// The short chat rules that arrive with the tools. They are stored with the message, so a change here
// reaches new conversations only and never edits one that has the old text.
export const KITCHEN_RULES = [
  "Kitchen tools",
  "The kitchen tools are available in this conversation. Use them for a new recipe, a change to a recipe and a meal plan, and pass on the person's own words. Never invent a recipe, an amount or a figure. Report what the tool returned, and when a kitchen tool cannot do what was asked, say so in one short sentence.",
  "For what the person usually eats, call get_palate_profile and name only what it returned: the foods, how often, and what they avoid. Never name a food, a habit or a figure it did not return. Allergies are matched by name only, so say so when one comes up.",
  "For a new recipe, call suggest_recipe with the figures the person gave for one serving. With no calories and protein, ask with ask_user and never choose figures. The card shows the recipe, so do not list it. Say how close it is, any line not matched and any food left out because they avoid it. If it could not be written (including without a food they avoid) or took too long, say so in one short sentence, and that nothing was saved.",
  "To change a saved recipe, call adjust_recipe with its id. The card shows it. Say how close it is, any food it added and that the method does not mention it, or why it could not be adjusted, and that the recipe is unchanged.",
].join("\n");

export type ToolAdditionBlock = {
  type: "tool_addition";
  tool: { type: "tool_reference"; name: string };
};

// What the stored system message holds: one `tool_addition` block for each kitchen tool, in the order the tools
// are listed, then the rules.
export function kitchenAdditionContent(toolNames: readonly string[]): SystemBlock[] {
  return [
    ...toolNames.map((name): ToolAdditionBlock => ({
      type: "tool_addition",
      tool: { type: "tool_reference", name },
    })),
    { type: "text", text: KITCHEN_RULES },
  ];
}

// A stored kitchen row as the API gets it: a system message that holds `tool_addition` blocks. SDK 1.3.0 types
// those on its beta resource only, and `prompt.ts` sends them to the same endpoint with `KITCHEN_BETA`.
export type SystemBlock = ToolAdditionBlock | Anthropic.TextBlockParam;
export type KitchenSystemMessage = { role: "system"; content: SystemBlock[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Whether the messages hold the addition: a system message with a `tool_addition` block in it.
export function holdsKitchenAddition(
  messages: readonly { role: string; content: unknown }[],
): boolean {
  return messages.some(
    (message) =>
      message.role === "system" &&
      Array.isArray(message.content) &&
      message.content.some((block) => isRecord(block) && block["type"] === "tool_addition"),
  );
}

export type KitchenPlan = {
  // Whether the model has been shown the group in this conversation, so a kitchen tool may be called.
  surfaced: boolean;
  // Whether this turn stores the addition now.
  append: boolean;
};

// What a turn does about the group. `held` is whether the messages the next request replays already hold the
// addition, `everStored` whether any row of the conversation does, a row a compaction has since replaced by a
// note included. The group is sticky: once the conversation has had it, every later turn has it, and a turn
// whose replay lost it (after a compaction, or because a failed turn left a row that is not sent) stores it again.
export function planKitchen({
  enabled,
  text,
  entry,
  held,
  everStored,
}: {
  enabled: boolean;
  text: string;
  entry?: KitchenEntry | undefined;
  held: boolean;
  everStored: boolean;
}): KitchenPlan {
  if (!enabled) {
    return { surfaced: false, append: false };
  }
  if (held) {
    return { surfaced: true, append: false };
  }
  const wanted = everStored || isKitchenRequest(text, entry);
  return { surfaced: wanted, append: wanted };
}
