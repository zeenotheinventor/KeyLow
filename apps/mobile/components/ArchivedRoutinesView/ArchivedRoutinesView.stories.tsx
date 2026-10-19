import { View } from "react-native";

import { ArchivedRoutinesView } from "./ArchivedRoutinesView";
import { sampleArchivedRoutines } from "../RoutinesView/sampleRoutines";

import type { Meta, StoryObj } from "@storybook/react-native";

// The archived routines are reached from the list's Archived row, so these stories are how its states are
// seen. The props are a union, which Storybook's args typing cannot hold, so each story renders its own view.
const meta = {
  title: "Train/ArchivedRoutinesView",
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

// The `routines · archived` board as it ships first: the note and the routine, with no Restore.
export const Archived: Story = {
  render: () => (
    <ArchivedRoutinesView
      routines={sampleArchivedRoutines}
      status="ready"
      onBack={() => undefined}
    />
  ),
};

// With Restore, which the make active ticket supplies.
export const WithRestore: Story = {
  render: () => (
    <ArchivedRoutinesView
      routines={sampleArchivedRoutines}
      status="ready"
      onBack={() => undefined}
      onRestore={() => undefined}
    />
  ),
};

// Not drawn: the first read is on its way.
export const Loading: Story = {
  render: () => <ArchivedRoutinesView status="loading" onBack={() => undefined} />,
};

// Not drawn: the first read failed.
export const Failed: Story = {
  render: () => (
    <ArchivedRoutinesView status="error" onBack={() => undefined} onRetry={() => undefined} />
  ),
};
