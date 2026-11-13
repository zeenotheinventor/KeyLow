import { CircleAlert, Clock, Lock, Moon, PowerOff } from "lucide-react";

import { AssistantNotice } from "./AssistantNotice";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/AssistantNotice",
  component: AssistantNotice,
  decorators: [
    (Story) => (
      // The notice sits in the assistant panel, which is the sheet surface, 400 px wide with 16 px at the sides.
      <div className="flex w-[400px] max-w-full flex-col gap-3 bg-surface-sheet p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AssistantNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DayLimit: Story = {
  args: {
    icon: Clock,
    title: "You have used today's turns",
    paragraphs: [
      "The assistant is back at midnight. Logging, search and quick add work as normal.",
    ],
  },
};

export const Plus: Story = {
  args: {
    icon: Lock,
    title: "The assistant is part of Ki-Lo Plus",
    paragraphs: [
      "Your account does not include Ki-Lo Plus at the moment. Logging, search and quick add work as normal.",
    ],
  },
};

export const Resting: Story = {
  args: {
    icon: Moon,
    title: "The assistant is resting until 1 December",
    paragraphs: [
      "It has reached this month's limit. Your conversations are kept. Everything else in Ki-Lo works as normal.",
    ],
  },
};

export const SwitchedOff: Story = {
  args: {
    icon: PowerOff,
    title: "The assistant is switched off for now",
    paragraphs: ["Try again later. Everything else in Ki-Lo works as normal."],
  },
};

export const FailedTurn: Story = {
  args: {
    icon: CircleAlert,
    tone: "danger",
    title: "That answer did not come through",
    paragraphs: ["Nothing was changed. Check your connection and try again."],
    buttons: [
      {
        label: "Try again",
        onClick: () => undefined,
      },
    ],
  },
};
