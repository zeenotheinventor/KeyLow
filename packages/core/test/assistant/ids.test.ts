import { describe, expect, it } from "vitest";

import { loggedCard } from "./cardFixtures";
import {
  assistantCardLinkSchema,
  assistantCardSchema,
  assistantStreamEventSchema,
  assistantTurnRequestSchema,
} from "../../src/assistant";

// Seed and fixture ids are fixed literals like this one, which z.uuid() refuses because its version
// and variant digits are not RFC 4122 ones. z.guid() takes any 8-4-4-4-12 hex id, as the repo's other schemas do.
const seedId = "11111111-1111-1111-1111-111111111111";

const parsersByIdField = [
  {
    field: "turnId",
    parse: (id: string) =>
      assistantStreamEventSchema.safeParse({
        type: "turn",
        turnId: id,
        conversationId: seedId,
      }),
  },
  {
    field: "conversationId on the turn event",
    parse: (id: string) =>
      assistantStreamEventSchema.safeParse({ type: "turn", turnId: seedId, conversationId: id }),
  },
  {
    field: "confirmationId",
    parse: (id: string) =>
      assistantStreamEventSchema.safeParse({
        type: "confirm",
        confirmationId: id,
        question: "Archive Chicken and rice?",
        confirmLabel: "Archive recipe",
        cancelLabel: "Keep it",
        tone: "primary",
      }),
  },
  {
    field: "conversationId on the turn request",
    parse: (id: string) =>
      assistantTurnRequestSchema.safeParse({
        conversationId: id,
        text: "Hi",
        localDate: "2026-10-25",
        localTime: null,
      }),
  },
  {
    field: "actionIds",
    parse: (id: string) => assistantCardSchema.safeParse({ ...loggedCard, actionIds: [id] }),
  },
  {
    field: "recipeId on a recipe_editor link",
    parse: (id: string) =>
      assistantCardLinkSchema.safeParse({
        label: "Open in recipe editor",
        target: { screen: "recipe_editor", recipeId: id },
      }),
  },
  {
    field: "recipeId on a recipe_add_ingredient link",
    parse: (id: string) =>
      assistantCardLinkSchema.safeParse({
        label: "Choose a food for the wine",
        target: { screen: "recipe_add_ingredient", recipeId: id, query: "white wine" },
      }),
  },
  {
    field: "foodId",
    parse: (id: string) =>
      assistantCardLinkSchema.safeParse({
        label: "Open in your foods",
        target: { screen: "own_food", foodId: id },
      }),
  },
];

describe.each(parsersByIdField)("the $field id", ({ parse }) => {
  it("should parse an id whose version and variant digits are not RFC 4122 ones", () => {
    expect(parse(seedId).success).toBe(true);
  });

  it("should reject a string that is not an id", () => {
    expect(parse("not-an-id").success).toBe(false);
  });
});
