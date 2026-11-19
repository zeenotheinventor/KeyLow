import { View } from "react-native";

import { BackfillCard } from "./BackfillCard";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Achievements/BackfillCard",
  component: BackfillCard,
  decorators: [
    (Story) => (
      <View className="flex-1 p-4">
        <Story />
      </View>
    ),
  ],
  args: { onSeeBadges: () => undefined, onDismiss: () => undefined },
} satisfies Meta<typeof BackfillCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// Board 3: 23 badges and level 4.
export const Default: Story = { args: { badgeCount: 23, level: 4 } };

// One badge reads in the singular.
export const OneBadge: Story = { args: { badgeCount: 1, level: 1 } };
