import { CategorySection } from "./CategorySection";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { sampleCategory } from "@/components/achievements/storyStates";

const meta = {
  title: "Achievements/CategorySection",
  component: CategorySection,
  decorators: [
    (Story) => (
      <div className="max-w-[1180px] p-6">
        <Story />
      </div>
    ),
  ],
  args: { onOpenBadge: () => undefined },
} satisfies Meta<typeof CategorySection>;

export default meta;

type Story = StoryObj<typeof meta>;

// The board's first section: 8 across from the large breakpoint and 4 across below it.
export const DailyStreaks: Story = {
  args: { category: sampleCategory("daily-streaks") },
};

export const HiddenAndSeasonal: Story = {
  args: { category: sampleCategory("hidden-and-seasonal") },
};

export const Milestones: Story = {
  args: { category: sampleCategory("milestones") },
};
