import { View } from "react-native";

import { RoutinesView } from "./RoutinesView";
import { sampleActiveRoutine, sampleOtherRoutines } from "./sampleRoutines";

import type { Meta, StoryObj } from "@storybook/react-native";

// The routines list is reached from the Train home once the editor ships, so these stories are how its
// states are seen. The props are a union, which Storybook's args typing cannot hold, so each story renders
// its own view.
const navigation = {
  onBack: () => undefined,
  onOpenArchived: () => undefined,
};

const meta = {
  title: "Train/RoutinesView",
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

const ready = {
  status: "ready",
  active: sampleActiveRoutine,
  others: sampleOtherRoutines,
  archivedCount: 1,
} as const;

// The `routines · list` board as it ships first: no control but Back and the Archived link.
export const List: Story = { render: () => <RoutinesView {...navigation} {...ready} /> };

// Every control the later tickets add: New routine, Edit and Make active.
export const ListWithControls: Story = {
  render: () => (
    <RoutinesView
      {...navigation}
      {...ready}
      onCreateRoutine={() => undefined}
      onEditRoutine={() => undefined}
      onMakeActive={() => undefined}
    />
  ),
};

// The `routines · empty` board as it ships first: the words, and no button.
export const Empty: Story = {
  render: () => (
    <RoutinesView {...navigation} active={null} archivedCount={0} others={[]} status="ready" />
  ),
};

// With Create routine, which the editor ticket supplies.
export const EmptyWithCreate: Story = {
  render: () => (
    <RoutinesView
      {...navigation}
      active={null}
      archivedCount={0}
      others={[]}
      status="ready"
      onCreateRoutine={() => undefined}
    />
  ),
};

// Not drawn: no routine is active, but some are saved.
export const NoActiveRoutine: Story = {
  render: () => <RoutinesView {...navigation} {...ready} active={null} />,
};

// Not drawn: the first read is on its way.
export const Loading: Story = {
  render: () => <RoutinesView {...navigation} status="loading" />,
};

// Not drawn: the first read failed.
export const Failed: Story = {
  render: () => <RoutinesView {...navigation} status="error" onRetry={() => undefined} />,
};
