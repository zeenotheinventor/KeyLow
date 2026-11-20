import { ScrollView } from "react-native";

import { storyCategory } from "../storyFixtures";
import { CategorySection } from "./CategorySection";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Achievements/CategorySection",
  component: CategorySection,
  decorators: [
    (Story) => (
      <ScrollView contentContainerClassName="p-5">
        <Story />
      </ScrollView>
    ),
  ],
  args: { onOpenBadge: () => undefined },
} satisfies Meta<typeof CategorySection>;

export default meta;

type Story = StoryObj<typeof meta>;

// Board 1's Daily streaks: earned, locked with progress and the count at the right of the heading.
export const DailyStreaks: Story = { args: { category: storyCategory(2) } };

// This category holds the hidden badges, which show as ???.
export const HiddenAndSeasonal: Story = { args: { category: storyCategory(12) } };

// The last category holds the two visible milestone badges.
export const Milestones: Story = { args: { category: storyCategory(13) } };
