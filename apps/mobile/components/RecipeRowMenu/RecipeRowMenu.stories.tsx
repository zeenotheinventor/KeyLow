import { View } from "react-native";

import { RecipeLibraryView } from "../RecipeLibraryView";
import { RecipeRowMenu } from "./RecipeRowMenu";
import { sampleRecipes } from "../RecipeLibraryView/sampleRecipes";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Recipes/RecipeRowMenu",
  component: RecipeRowMenu,
  decorators: [
    (Story) => (
      <View className="flex-1 bg-background">
        <Story />
      </View>
    ),
  ],
  args: {
    recipeName: "Chicken and rice",
    open: true,
    onClose: () => undefined,
    onDuplicate: () => undefined,
    onArchive: () => undefined,
  },
} satisfies Meta<typeof RecipeRowMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

// The recipes row-menu board: the library under the dim, and the sheet titled with the recipe's name. An
// element in a story's args breaks the on-device story index, so the library is drawn in render.
export const RowMenu: Story = {
  render: (args) => (
    <>
      <RecipeLibraryView
        archivedCount={2}
        recipes={sampleRecipes}
        status="ready"
        onArchiveRecipe={() => undefined}
        onDuplicateRecipe={() => undefined}
        onNewRecipe={() => undefined}
        onOpenArchived={() => undefined}
        onOpenShoppingList={() => undefined}
        onOpenRecipe={() => undefined}
      />
      <RecipeRowMenu {...args} />
    </>
  ),
};
