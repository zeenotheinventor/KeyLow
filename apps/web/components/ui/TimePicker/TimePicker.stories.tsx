import { TimePicker } from "./TimePicker";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/TimePicker",
  component: TimePicker,
  args: { open: true, value: "12:40", onApply: () => undefined, onClose: () => undefined },
  // The picker sits under the control that opens it, so the story draws a stand-in for the field above it.
  decorators: [
    (Story) => (
      <div className="min-h-[420px] max-w-xl p-6">
        <div className="h-control-md w-40 rounded-medium border border-accent bg-surface-raised" />
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AtLunchtime: Story = {};

export const AtMidnight: Story = { args: { value: "00:00" } };

export const AtEndOfDay: Story = { args: { value: "23:59" } };

// Below 700 px the picker is a bottom panel with a scrim, a title and a caption over each column.
export const Narrow: Story = { globals: { viewport: { value: "mobile", isRotated: false } } };

export const NarrowAtEndOfDay: Story = {
  args: { value: "23:59" },
  globals: { viewport: { value: "mobile", isRotated: false } },
};
