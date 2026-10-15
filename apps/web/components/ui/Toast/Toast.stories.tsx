import { Check, CircleAlert, Info, TriangleAlert, Trash2 } from "lucide-react";

import { Toast } from "./Toast";

import type { Meta, StoryObj } from "@storybook/nextjs";

// A toast sits in the corner of the screen it is on. The frame stands in for that screen, so the
// toast keeps its bottom right corner at a wide width and spans the width at a narrow one. The
// toolbar switches the theme. The stories leave out onClose so the toast stays for inspection.
const meta = {
  title: "UI/Toast",
  component: Toast,
  decorators: [
    (Story) => (
      <div className="relative h-48">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Neutral: Story = {
  args: { message: "Copied 8 entries to today", icon: Info },
};

export const Success: Story = {
  args: { message: "Entry added", tone: "success", icon: Check },
};

export const Warning: Story = {
  args: { message: "Some entries are missing a portion", tone: "warning", icon: TriangleAlert },
};

export const Danger: Story = {
  args: { message: "Entry could not be saved", tone: "danger", icon: CircleAlert },
};

export const WithUndo: Story = {
  args: { message: "Entry deleted", actionLabel: "Undo", icon: Trash2 },
};
