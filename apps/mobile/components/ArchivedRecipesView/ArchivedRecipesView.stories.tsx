import { View } from "react-native";

import { ArchivedRecipesView } from "./ArchivedRecipesView";
import { archivedSampleRecipes } from "../RecipeLibraryView/sampleRecipes";

import type { Meta, StoryObj } from "@storybook/react-native";

// The archived recipes screen is reached from the library's row, so these stories are how its states are
// seen. The props are a union, which Storybook's args typing cannot hold, so each story renders its own view.
const actions = {
  onBack: () => undefined,
};

const meta = {
  title: "Recipes/ArchivedRecipesView",
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

// The recipes archived board: the note and the two archived recipes, each with Restore.
export const Archived: Story = {
  render: () => (
    <ArchivedRecipesView
      {...actions}
      recipes={archivedSampleRecipes}
      status="ready"
      onRestore={() => undefined}
    />
  ),
};

// What is left when the last one is restored: the note and Nothing archived.
export const Nothing: Story = {
  render: () => (
    <ArchivedRecipesView {...actions} recipes={[]} status="ready" onRestore={() => undefined} />
  ),
};

// Not drawn: recipes loaded earlier in the session stay readable, and Restore is off.
export const OfflineWithRecipes: Story = {
  render: () => (
    <ArchivedRecipesView
      {...actions}
      isOnline={false}
      recipes={archivedSampleRecipes}
      status="ready"
      onRestore={() => undefined}
    />
  ),
};

// Not drawn: opened with nothing in memory. The library's own states are reused.
export const Loading: Story = {
  render: () => <ArchivedRecipesView {...actions} status="loading" />,
};

export const Failed: Story = {
  render: () => <ArchivedRecipesView {...actions} status="error" onRetry={() => undefined} />,
};

export const Offline: Story = {
  render: () => <ArchivedRecipesView {...actions} status="offline" />,
};
