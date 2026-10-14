import { KiLoMark } from "./KiLoMark";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/KiLoMark",
  component: KiLoMark,
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof KiLoMark>;

export default meta;

type Story = StoryObj<typeof meta>;

// The shell's size, beside the wordmark.
export const Default: Story = {};

// The sign in size, above the heading.
export const Large: Story = { args: { className: "size-12" } };

export const WithTitle: Story = { args: { title: "Ki-Lo" } };
