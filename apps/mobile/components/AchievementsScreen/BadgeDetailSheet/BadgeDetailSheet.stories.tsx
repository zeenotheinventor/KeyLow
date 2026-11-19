import { View } from "react-native";

import { Text } from "../../ui";
import { storyDetail } from "../storyFixtures";
import { BadgeDetailSheet } from "./BadgeDetailSheet";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Achievements/BadgeDetailSheet",
  component: BadgeDetailSheet,
  decorators: [
    // The sheet covers its parent, as the board draws it over the Achievements screen.
    (Story) => (
      <View className="flex-1 p-4">
        <Text variant="h1">Achievements</Text>
        <Story />
      </View>
    ),
  ],
  args: { open: true, onClose: () => undefined },
} satisfies Meta<typeof BadgeDetailSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

// Board 2, earned: the tier and category, how it was earned, the day and the points.
export const Earned: Story = { args: { detail: storyDetail("fortnight") } };

// Board 2, locked: the progress bar and line, what it is worth and the freeze it brings.
export const Locked: Story = { args: { detail: storyDetail("month-strong") } };

// A locked silver badge has no freeze to bring, so it has only its worth.
export const LockedSilver: Story = { args: { detail: storyDetail("habit-forming") } };

// Board 2, hidden: the secret is kept.
export const Hidden: Story = { args: { detail: storyDetail("midnight-snack") } };
