import { View } from "react-native";

import { RecipeLibraryView } from "./RecipeLibraryView";
import { sampleRecipes } from "./sampleRecipes";

import type { Meta, StoryObj } from "@storybook/react-native";

// The Recipes tab still shows Coming soon, so these stories are how the library is seen: each state of the
// boards. The props are a union, which Storybook's args typing cannot hold, so each story renders its own view.
const actions = {
  onOpenRecipe: () => undefined,
  onNewRecipe: () => undefined,
};

const meta = {
  title: "Recipes/RecipeLibraryView",
  decorators: [
    (Story) => (
      <View className="flex-1 bg-background">
        <Story />
      </View>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// The recipes library board: the five recipes, nothing typed.
export const Library: Story = {
  render: () => <RecipeLibraryView {...actions} recipes={sampleRecipes} status="ready" />,
};

// The recipes search board: "chi" typed, with the matched letters in bold.
export const Search: Story = {
  render: () => (
    <RecipeLibraryView {...actions} initialQuery="chi" recipes={sampleRecipes} status="ready" />
  ),
};

// The recipes no-matches board: "pasta" typed.
export const NoMatches: Story = {
  render: () => (
    <RecipeLibraryView {...actions} initialQuery="pasta" recipes={sampleRecipes} status="ready" />
  ),
};

export const Empty: Story = {
  render: () => <RecipeLibraryView {...actions} recipes={[]} status="ready" />,
};

// The rows appear after 200 ms, as the skeleton does everywhere.
export const Loading: Story = {
  render: () => <RecipeLibraryView {...actions} status="loading" />,
};

export const Failed: Story = {
  render: () => <RecipeLibraryView {...actions} status="error" onRetry={() => undefined} />,
};

// The recipes offline board: nothing in memory, so no list.
export const Offline: Story = {
  render: () => <RecipeLibraryView {...actions} status="offline" />,
};

// The board note: recipes loaded earlier in the session stay readable, and changes are off.
export const OfflineWithRecipes: Story = {
  render: () => (
    <RecipeLibraryView {...actions} isOnline={false} recipes={sampleRecipes} status="ready" />
  ),
};
