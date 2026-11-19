import { BadgeTile } from "./BadgeTile";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Achievements/BadgeTile",
  component: BadgeTile,
  decorators: [
    (Story) => (
      <div className="w-32 p-6">
        <Story />
      </div>
    ),
  ],
  args: { onOpen: () => undefined },
} satisfies Meta<typeof BadgeTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Earned: Story = {
  args: {
    badge: {
      id: "fortnight",
      name: "Fortnight",
      state: "earned",
      subLine: "Silver",
      progressWords: undefined,
    },
  },
};

export const Locked: Story = {
  args: {
    badge: {
      id: "habit-forming",
      name: "Habit Forming",
      state: "locked",
      subLine: "12 of 21",
      progressWords: "12 of 21 days",
    },
  },
};

export const Hidden: Story = {
  args: {
    badge: {
      id: "leap-of-faith",
      name: "Hidden badge",
      state: "hidden",
      subLine: "Secret",
      progressWords: undefined,
    },
  },
};
