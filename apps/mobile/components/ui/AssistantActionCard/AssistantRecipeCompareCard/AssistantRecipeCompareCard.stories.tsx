import { describeRecipeCompareCard } from "@keylow/core";
import { View } from "react-native";

import { AssistantRecipeCompareCard } from "./AssistantRecipeCompareCard";

import type { AssistantRecipeCompareCardProps } from "./types";
import type { AdjustmentDraft } from "@keylow/core";
import type { Meta, StoryObj } from "@storybook/react-native";

// Each story is the board `assistant-card · recipe-compare`, or a state the board does not draw, named in its
// comment. The figures are the board's: Eval chicken and rice, 30 g more protein a serving.
const meta = {
  title: "UI/AssistantActionCard/AssistantRecipeCompareCard",
  component: AssistantRecipeCompareCard,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof AssistantRecipeCompareCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const line = (
  foodName: string,
  foodId: string,
  beforeGrams: number | null,
  grams: number,
  change: AdjustmentDraft["ingredients"][number]["change"],
): AdjustmentDraft["ingredients"][number] => ({
  name: foodName,
  foodId,
  foodName,
  foodSource: "cofid",
  grams,
  beforeGrams,
  kcal: null,
  change,
});

const chickenAndRiceDraft: AdjustmentDraft = {
  variant: "adjustment",
  recipeId: "00000000-0000-4000-8000-0000000000e1",
  name: "Eval chicken and rice",
  servings: 2,
  ingredients: [
    line(
      "Chicken, breast, grilled without skin, meat only",
      "00000000-0000-4000-8000-0000000000f1",
      260,
      455,
      "changed",
    ),
    line(
      "Rice, white, long grain, boiled in unsalted water",
      "00000000-0000-4000-8000-0000000000f2",
      360,
      180,
      "changed",
    ),
    line("Oil, olive", "00000000-0000-4000-8000-0000000000f5", 15, 10, "changed"),
    line(
      "Broccoli, green, boiled in unsalted water",
      "00000000-0000-4000-8000-0000000000f3",
      160,
      160,
      "same",
    ),
  ],
  dropped: [],
  before: { kcal: 518.2, protein_g: 49.3, carbs_g: 58.4, fat_g: 11.2 },
  perServing: { kcal: 522.4, protein_g: 78.4, carbs_g: 30.1, fat_g: 11.3 },
  fit: { status: "within", target: { kcal: 518.2, protein_g: 79.3 }, misses: [] },
  steps: ["Cook the rice.", "Grill the chicken.", "Steam the broccoli."],
};

const cardArgs = (
  draft: AdjustmentDraft,
  overrides: Partial<AssistantRecipeCompareCardProps> = {},
): AssistantRecipeCompareCardProps => ({
  card: describeRecipeCompareCard(draft, { isSaved: overrides.savedLink !== undefined }),
  isSaving: false,
  saveLabel: "Save as new recipe",
  onSave: () => undefined,
  ...overrides,
});

// The meta's own props, which the render below does not use.
const storyArgs = cardArgs(chickenAndRiceDraft);

const renderCard = (args: AssistantRecipeCompareCardProps) => (
  <AssistantRecipeCompareCard {...args} />
);

// `assistant-card · recipe-compare`: before and after, the fit line, the changed lines and Save as new recipe.
export const RecipeCompare: Story = {
  args: storyArgs,
  render: () => renderCard(cardArgs(chickenAndRiceDraft)),
};

// NOT ON THE CANVAS: the fitter added a food of the person's own, which is not in the recipe's method.
export const RecipeCompareAdded: Story = {
  args: storyArgs,
  render: () =>
    renderCard(
      cardArgs({
        ...chickenAndRiceDraft,
        ingredients: [
          ...chickenAndRiceDraft.ingredients,
          line(
            "Yogurt, Greek style, plain",
            "00000000-0000-4000-8000-0000000000f4",
            null,
            120,
            "added",
          ),
        ],
      }),
    ),
};

// NOT ON THE CANVAS: a version that fell short, the fit line warns with what held it back.
export const RecipeCompareShort: Story = {
  args: storyArgs,
  render: () =>
    renderCard(
      cardArgs({
        ...chickenAndRiceDraft,
        fit: {
          status: "unreachable",
          target: { kcal: 518.2, protein_g: 79.3 },
          misses: [
            {
              nutrient: "protein_g",
              target: 79.3,
              achieved: 70,
              reason: "ingredient_bounds",
              limitedBy: ["Chicken, breast, grilled without skin, meat only"],
            },
          ],
        },
      }),
    ),
};

// NOT ON THE CANVAS, the saved state of `assistant-card · recipe-draft-saved` for a compare card: the action gives way to the link.
export const RecipeCompareSaved: Story = {
  args: storyArgs,
  render: () =>
    renderCard(
      cardArgs(chickenAndRiceDraft, {
        savedLink: { label: "Open in recipe editor", onPress: () => undefined },
      }),
    ),
};

// NOT ON THE CANVAS, the failed state of `assistant-card · recipe-draft-failed` for a compare card: a danger line above the action.
export const RecipeCompareSaveFailed: Story = {
  args: storyArgs,
  render: () =>
    renderCard(
      cardArgs(chickenAndRiceDraft, {
        saveError: "Not saved. Check your connection and try again.",
      }),
    ),
};

// Save as new recipe while the foods load.
export const RecipeCompareSaving: Story = {
  args: storyArgs,
  render: () => renderCard(cardArgs(chickenAndRiceDraft, { isSaving: true })),
};
